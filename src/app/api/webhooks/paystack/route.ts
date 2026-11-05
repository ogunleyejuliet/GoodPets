import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPaystackSignature } from '@/lib/paystack';
import { confirmBookingPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract raw body text and signature header
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    // 2. Strict HMAC-SHA512 signature validation (constant-time)
    const isValid = verifyPaystackSignature(rawBody, signature);
    if (!isValid) {
      console.warn('Paystack webhook rejected: Invalid signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // 3. Parse JSON event payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const eventType = payload.event || 'unknown';
    const eventData = payload.data || {};
    const reference = eventData.reference || null;
    const paystackId = eventData.id ? String(eventData.id) : null;

    // Deduplication key per PRD FR-016 / BR-036
    const dedupeKey = paystackId
      ? `paystack:${eventType}:${paystackId}`
      : `paystack:${eventType}:${reference || Date.now()}`;

    // 4. Status-aware deduplication and record acquisition (Fix 1)
    let webhookRecord = await prisma.webhookEvent.findUnique({
      where: { dedupeKey },
    });

    if (webhookRecord) {
      // PROCESSED: return HTTP 200 as duplicate without reprocessing
      if (webhookRecord.status === 'PROCESSED') {
        return NextResponse.json(
          { received: true, deduplicated: true, status: 'PROCESSED' },
          { status: 200 }
        );
      }

      // IGNORED: return HTTP 200 without reprocessing
      if (webhookRecord.status === 'IGNORED') {
        return NextResponse.json(
          { received: true, deduplicated: true, status: 'IGNORED' },
          { status: 200 }
        );
      }

      // FAILED or RECEIVED: allow safe retry/recovery using existing record
      // Atomically claim the retry using a conditional update
      const claimResult = await prisma.webhookEvent.updateMany({
        where: {
          id: webhookRecord.id,
          status: { in: ['FAILED', 'RECEIVED'] },
        },
        data: {
          status: 'RECEIVED',
          error: null,
          receivedAt: new Date(),
        },
      });

      if (claimResult.count === 0) {
        // Another concurrent request claimed or completed this record
        const latest = await prisma.webhookEvent.findUnique({
          where: { id: webhookRecord.id },
        });
        if (latest && (latest.status === 'PROCESSED' || latest.status === 'IGNORED')) {
          return NextResponse.json(
            { received: true, deduplicated: true, status: latest.status },
            { status: 200 }
          );
        }
      }
    } else {
      // New incoming webhook event
      try {
        webhookRecord = await prisma.webhookEvent.create({
          data: {
            provider: 'paystack',
            dedupeKey,
            eventType,
            reference,
            payloadSummary: {
              event: eventType,
              id: paystackId,
              reference,
              amount: eventData.amount,
              currency: eventData.currency,
              status: eventData.status,
              channel: eventData.channel,
            },
            status: 'RECEIVED',
          },
        });
      } catch (createErr: any) {
        // Handle concurrent insert race condition (P2002 Unique constraint on dedupeKey)
        if (createErr.code === 'P2002') {
          webhookRecord = await prisma.webhookEvent.findUnique({
            where: { dedupeKey },
          });
          if (webhookRecord && (webhookRecord.status === 'PROCESSED' || webhookRecord.status === 'IGNORED')) {
            return NextResponse.json(
              { received: true, deduplicated: true, status: webhookRecord.status },
              { status: 200 }
            );
          }
        } else {
          console.error('Failed to create webhookRecord:', createErr);
          return NextResponse.json(
            { error: 'Internal server error recording webhook' },
            { status: 500 }
          );
        }
      }
    }

    if (!webhookRecord) {
      return NextResponse.json(
        { error: 'Unable to track webhook event' },
        { status: 500 }
      );
    }

    // 5. Handle event types
    if (eventType === 'charge.success') {
      if (!reference) {
        // Permanent validation failure on payload
        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: { status: 'FAILED', error: 'Missing reference in charge.success' },
        });
        return NextResponse.json(
          { error: 'Missing reference in charge.success payload' },
          { status: 400 }
        );
      }

      try {
        // Execute atomic confirmation
        const result = await confirmBookingPayment(reference, {
          verifiedData: eventData,
        });

        if (result.success) {
          await prisma.webhookEvent.update({
            where: { id: webhookRecord.id },
            data: {
              status: 'PROCESSED',
              error: null,
              processedAt: new Date(),
            },
          });
          return NextResponse.json({ received: true, status: 'PROCESSED' }, { status: 200 });
        } else {
          // Permanent domain validation failure (amount/currency mismatch, or payment not found)
          await prisma.webhookEvent.update({
            where: { id: webhookRecord.id },
            data: {
              status: 'FAILED',
              error: result.error || 'Payment confirmation rejected',
              processedAt: new Date(),
            },
          });
          // For permanent business validation failure, acknowledge so Paystack does not retry endlessly
          return NextResponse.json(
            { received: true, processed: false, error: result.error },
            { status: 200 }
          );
        }
      } catch (err: any) {
        // Transient processing failure (database timeout, network error, etc.) - Fix 2
        console.error(`Transient error processing webhook charge.success for ref ${reference}:`, err);
        try {
          await prisma.webhookEvent.update({
            where: { id: webhookRecord.id },
            data: {
              status: 'FAILED',
              error: err.message || 'Transient error executing confirmation',
            },
          });
        } catch (dbErr) {
          console.error('Failed to update webhookRecord status during error handling:', dbErr);
        }

        // Return HTTP 500 so Paystack can retry transient failure
        return NextResponse.json(
          { error: 'Internal server error processing webhook' },
          { status: 500 }
        );
      }
    } else {
      // Other events are acknowledged and marked IGNORED
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'IGNORED',
          processedAt: new Date(),
        },
      });
      return NextResponse.json({ received: true, status: 'IGNORED' }, { status: 200 });
    }
  } catch (error: any) {
    console.error('Unhandled top-level error in Paystack webhook handler:', error);
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 }
    );
  }
}
