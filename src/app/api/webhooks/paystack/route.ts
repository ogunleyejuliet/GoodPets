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

    // 4. Check for duplicate webhook delivery
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { dedupeKey },
    });

    if (existingEvent) {
      // Idempotent: return 200 OK immediately
      return NextResponse.json(
        { received: true, deduplicated: true },
        { status: 200 }
      );
    }

    // 5. Record incoming webhook event
    const webhookRecord = await prisma.webhookEvent.create({
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

    // 6. Handle event types
    if (eventType === 'charge.success') {
      if (!reference) {
        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: { status: 'FAILED', error: 'Missing reference in charge.success' },
        });
        return NextResponse.json(
          { error: 'Missing reference' },
          { status: 400 }
        );
      }

      try {
        // Execute atomic confirmation
        const result = await confirmBookingPayment(reference, {
          verifiedData: eventData,
        });

        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            status: result.success ? 'PROCESSED' : 'FAILED',
            error: result.error || null,
            processedAt: new Date(),
          },
        });
      } catch (err: any) {
        console.error(`Error processing webhook charge.success for ref ${reference}:`, err);
        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            status: 'FAILED',
            error: err.message || 'Error executing confirmation',
          },
        });
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
    }

    // Prompt 200 OK acknowledgment
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Unhandled error in Paystack webhook handler:', error);
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 }
    );
  }
}

