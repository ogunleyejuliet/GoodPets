import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  generateRawVerificationCode,
  createVerificationCodeRecord,
  hashVerificationCode,
} from '@/lib/tokens';
import { createEmailOutboxRecord } from '@/lib/outbox';
import { inngest } from '@/inngest/client';
import { processOutboxVerificationEmail } from '@/inngest/functions/send-verification-email';
import {
  deriveRateLimitKey,
  reserveRateLimits,
  RateLimitExceededError,
  RateLimitConfigError,
  RateLimitUnavailableError,
} from '@/lib/rate-limit';

const GENERIC_SUCCESS_MESSAGE =
  'If an unverified account exists for this email address, a new 6-digit verification code has been sent.';

/**
 * POST /api/auth/resend-verification
 *
 * Re-issues a 6-digit verification code for unverified customer accounts.
 *
 * Requirements (Task 4 Step 10 Stage 6):
 * - Accepts and validates customer email.
 * - Normalizes email (trim + lowercase).
 * - Enforces database-backed rate limit: 3 resend requests per hour per normalized email address.
 * - Rate limit protects requests for both existing and nonexistent email addresses.
 * - Anti-enumeration: returns the exact same generic HTTP 200 for nonexistent, already verified,
 *   and unverified customer accounts.
 * - For eligible accounts:
 *   - Generates cryptographically secure 6-digit code.
 *   - Stores HMAC-SHA256 bound to userId (10-minute expiry).
 *   - Invalidates previous codes.
 *   - Creates encrypted EmailOutbox record transactionally.
 *   - Dispatches non-blocking SMTP email.
 * - Strictly does NOT issue a session cookie or auto-login.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const { email } = body || {};

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Rate Limiting (BR-039 / Stage 6: 3 requests/hour per normalized email address)
    // Applies before account lookup to protect nonexistent emails from probing/abuse
    try {
      const emailKey = deriveRateLimitKey('resend:email', normalizedEmail);
      await reserveRateLimits([{ key: emailKey, limit: 3, windowSeconds: 3600 }]);
    } catch (rlError) {
      if (rlError instanceof RateLimitExceededError) {
        console.warn(
          `[${timestamp}] POST /api/auth/resend-verification - Status: 429 - Rate limit exceeded for email: ${normalizedEmail}`
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Too many verification code requests. Please try again later.',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rlError.retryAfterSeconds) },
          }
        );
      }
      if (rlError instanceof RateLimitConfigError || rlError instanceof RateLimitUnavailableError) {
        return NextResponse.json(
          { success: false, error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      throw rlError;
    }

    // 2. Query user by normalized email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
      },
    });

    // 3. Anti-enumeration: If user does not exist, or is not eligible for verification
    // (staff role, already verified, or deactivated), perform dummy HMAC to mitigate timing attacks
    // and return the exact same generic HTTP 200 response
    if (!user || user.role !== 'CUSTOMER' || user.emailVerified !== null || !user.isActive) {
      // Dummy computation to normalize response timing with real hash generation
      hashVerificationCode('dummy-user-id', '123456');
      console.log(
        `[${timestamp}] POST /api/auth/resend-verification - Status: 200 - Generic response returned (ineligible/absent account)`
      );
      return NextResponse.json(
        {
          success: true,
          message: GENERIC_SUCCESS_MESSAGE,
        },
        { status: 200 }
      );
    }

    // 4. Eligible unverified customer account processing:
    // Transactionally invalidate previous code, create new HMAC AuthToken, and create encrypted EmailOutbox record
    const { outboxRecord } = await prisma.$transaction(async (tx) => {
      const generatedCode = generateRawVerificationCode();

      // createVerificationCodeRecord invalidates prior active codes and upserts new token with 10-minute expiry
      const authToken = await createVerificationCodeRecord(user.id, generatedCode, tx);

      // Persist AES-256-GCM encrypted payload in EmailOutbox
      const record = await createEmailOutboxRecord(
        {
          userId: user.id,
          tokenId: authToken.id,
          toEmail: user.email,
          rawCode: generatedCode,
        },
        tx
      );

      return { outboxRecord: record };
    });

    console.log(
      `[${timestamp}] POST /api/auth/resend-verification - Status: 200 - Verification code reissued for user ID: ${user.id} - Outbox: PENDING`
    );

    // 5. Dispatch Inngest background event for durable verification email delivery
    try {
      await inngest.send({
        name: 'auth/verification.email.requested',
        data: {
          outboxId: outboxRecord.id,
          email: user.email,
          name: user.name || 'there',
        },
      });
      console.log(
        `[${timestamp}] POST /api/auth/resend-verification - Inngest event dispatched for outbox ID: ${outboxRecord.id}`
      );
    } catch (inngestErr: any) {
      console.warn(
        `[${timestamp}] POST /api/auth/resend-verification - Inngest dispatch failed for outbox ID ${outboxRecord.id}, falling back to direct outbox processing:`,
        inngestErr?.message
      );
      // Fallback recovery: await immediate direct outbox processing so email delivery is durable in serverless runtimes
      try {
        const fallbackResult = await processOutboxVerificationEmail(outboxRecord.id, {
          name: user.name || 'there',
        });
        if (!fallbackResult.success) {
          console.warn(
            `[${timestamp}] POST /api/auth/resend-verification - Direct outbox fallback delivery deferred or failed for ID ${outboxRecord.id}:`,
            fallbackResult.error
          );
        } else {
          console.log(
            `[${timestamp}] POST /api/auth/resend-verification - Direct outbox fallback delivered successfully for ID ${outboxRecord.id}`
          );
        }
      } catch (fallbackErr: any) {
        console.error(
          `[${timestamp}] POST /api/auth/resend-verification - Direct outbox fallback encountered error for ID ${outboxRecord.id}:`,
          fallbackErr?.message
        );
      }
    }

    // 6. Return identical generic HTTP 200 response (NO session cookie issued)
    return NextResponse.json(
      {
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error(
      `[${timestamp}] POST /api/auth/resend-verification - Status: 500 - Error: ${errorMessage}`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process your request at this time. Please try again later.',
      },
      { status: 500 }
    );
  }
}
