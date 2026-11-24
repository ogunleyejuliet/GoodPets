import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  generateRawVerificationCode,
  createVerificationCodeRecord,
  hashVerificationCode,
} from '@/lib/tokens';
import { createEmailOutboxRecord } from '@/lib/outbox';
import { sendVerificationEmailDirect } from '@/lib/email';
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
    const { rawCode } = await prisma.$transaction(async (tx) => {
      const generatedCode = generateRawVerificationCode();

      // createVerificationCodeRecord invalidates prior active codes and upserts new token with 10-minute expiry
      const authToken = await createVerificationCodeRecord(user.id, generatedCode, tx);

      // Persist AES-256-GCM encrypted payload in EmailOutbox
      const outboxRecord = await createEmailOutboxRecord(
        {
          userId: user.id,
          tokenId: authToken.id,
          toEmail: user.email,
          rawCode: generatedCode,
        },
        tx
      );

      return { rawCode: generatedCode, authToken, outboxRecord };
    });

    console.log(
      `[${timestamp}] POST /api/auth/resend-verification - Status: 200 - Verification code reissued for user ID: ${user.id} - Outbox: PENDING`
    );

    // 5. Asynchronous non-blocking initial SMTP delivery
    sendVerificationEmailDirect({
      toEmail: user.email,
      code: rawCode,
      name: user.name || 'there',
    })
      .then((mailRes) => {
        if (!mailRes.success) {
          console.warn(
            `[${timestamp}] POST /api/auth/resend-verification - SMTP Delivery Note: ${mailRes.error || 'Dispatch deferred'}`
          );
        } else {
          console.log(
            `[${timestamp}] POST /api/auth/resend-verification - SMTP Email Sent Successfully - Message ID: ${mailRes.messageId}`
          );
        }
      })
      .catch((mailErr) => {
        console.warn(
          `[${timestamp}] Non-blocking SMTP resend dispatch note: ${mailErr?.message || 'deferred to outbox'}`
        );
      });

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
