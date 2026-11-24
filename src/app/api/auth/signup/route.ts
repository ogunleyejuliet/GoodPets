import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from '@node-rs/argon2';
import { generateRandomCustomerId } from '@/lib/auth';
import { signupSchema } from '@/lib/validations/auth';
import { isPasswordBreached, BreachedPasswordServiceError } from '@/lib/breached-password';
import { generateRawVerificationCode, createVerificationCodeRecord } from '@/lib/tokens';
import { createEmailOutboxRecord } from '@/lib/outbox';
import { sendVerificationEmailDirect } from '@/lib/email';
import {
  getClientIp,
  deriveRateLimitKey,
  reserveRateLimits,
  RateLimitClientIpError,
  RateLimitExceededError,
  RateLimitConfigError,
  RateLimitUnavailableError,
} from '@/lib/rate-limit';

// POST /api/auth/signup
// Handles customer registration with Argon2id password hashing and PostgreSQL persistence
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // 0. Rate limiting (BR-039: 5 requests per hour per IP; all attempts count)
    try {
      const clientIp = getClientIp(request);
      const ipKey = deriveRateLimitKey('signup:ip', clientIp);
      await reserveRateLimits([{ key: ipKey, limit: 5, windowSeconds: 3600 }]);
    } catch (rlError) {
      if (rlError instanceof RateLimitClientIpError) {
        return NextResponse.json(
          { success: false, error: rlError.message },
          { status: 400 }
        );
      }
      if (rlError instanceof RateLimitExceededError) {
        console.warn(`[${timestamp}] POST /api/auth/signup - Status: 429 - Rate limit exceeded`);
        return NextResponse.json(
          {
            success: false,
            error: 'Too many registration attempts. Please try again later.',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rlError.retryAfterSeconds) },
          }
        );
      }
      if (rlError instanceof RateLimitConfigError || rlError instanceof RateLimitUnavailableError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Service temporarily unavailable. Please try again shortly.',
          },
          { status: 503 }
        );
      }
      throw rlError;
    }

    const body = await request.json();

    // 1. Zod schema validation & normalization
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const firstErrorMessage = result.error.issues[0]?.message || 'Validation failed.';
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Validation failed: ${firstErrorMessage}`);
      return NextResponse.json(
        {
          success: false,
          error: firstErrorMessage,
          errors: fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    // 2. Duplicate email check
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 409 - Email already registered: ${email}`);
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // 2.5 Privacy-preserving breached password screening (k-anonymity via Pwned Passwords)
    try {
      const isBreached = await isPasswordBreached(password);
      if (isBreached) {
        console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Breached password rejected`);
        return NextResponse.json(
          {
            success: false,
            error: 'This password has appeared in a known data breach. For your security, please choose a different password.',
          },
          { status: 400 }
        );
      }
    } catch (breachError) {
      if (breachError instanceof BreachedPasswordServiceError) {
        console.error(
          `[${timestamp}] POST /api/auth/signup - Status: 503 - Breach screening unavailable: ${breachError.message}`
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Password security screening is temporarily unavailable. Please try again shortly.',
          },
          { status: 503 }
        );
      }
      throw breachError;
    }

    // 3. Secure Argon2id password hash (PRD FR-001 & BR-046)
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // 4. Database write in a single atomic transaction:
    // Creates User (with candidate customerId), EMAIL_VERIFICATION AuthToken (SHA-256 hash),
    // and EmailOutbox record (AES-256-GCM encrypted payload).
    // Client-supplied customer IDs are ignored; server always assigns a random 4-digit ID (1000-9999).
    let signupResult = null;
    const MAX_RETRIES = 5;
    let attempts = 0;

    while (!signupResult && attempts < MAX_RETRIES) {
      attempts++;
      const candidateCustomerId = generateRandomCustomerId();

      try {
        signupResult = await prisma.$transaction(async (tx) => {
          // 4a. Create User
          const createdUser = await tx.user.create({
            data: {
              customerId: candidateCustomerId,
              name,
              email,
              passwordHash,
              role: 'CUSTOMER',
              emailVerified: null,
            },
            select: {
              id: true,
              customerId: true,
              name: true,
              email: true,
              role: true,
              sessionVersion: true,
              createdAt: true,
            },
          });

          // 4b. Generate cryptographically secure 6-digit numeric verification code (100000 - 999999)
          const rawVerificationCode = generateRawVerificationCode();

          // 4c. Persist AuthToken record storing ONLY the HMAC hash (no plaintext in DB)
          const authToken = await createVerificationCodeRecord(
            createdUser.id,
            rawVerificationCode,
            tx
          );

          // 4d. Persist EmailOutbox record storing AES-256-GCM encrypted payload for transactional consistency
          const outboxRecord = await createEmailOutboxRecord(
            {
              userId: createdUser.id,
              tokenId: authToken.id,
              toEmail: createdUser.email,
              rawCode: rawVerificationCode,
            },
            tx
          );

          return { user: createdUser, authToken, outboxRecord, rawVerificationCode };
        });
      } catch (err: any) {
        // Handle unique constraint collision on customerId by generating another ID and retrying
        if (
          err?.code === 'P2002' &&
          (Array.isArray(err?.meta?.target) ? err.meta.target.includes('customerId') : err?.meta?.target === 'customerId')
        ) {
          console.warn(
            `[${timestamp}] Customer ID collision detected on ${candidateCustomerId}, retrying (attempt ${attempts}/${MAX_RETRIES})...`
          );
          continue;
        }

        // Handle concurrent duplicate email registration gracefully
        if (
          err?.code === 'P2002' &&
          (Array.isArray(err?.meta?.target) ? err.meta.target.includes('email') : err?.meta?.target === 'email')
        ) {
          console.warn(`[${timestamp}] POST /api/auth/signup - Status: 409 - Email already registered: ${email}`);
          return NextResponse.json(
            { success: false, error: 'An account with this email address already exists. Please sign in instead.' },
            { status: 409 }
          );
        }

        throw err;
      }
    }

    if (!signupResult) {
      console.error(`[${timestamp}] Failed to assign a unique customer ID after ${MAX_RETRIES} attempts.`);
      return NextResponse.json(
        { success: false, error: 'Unable to assign a unique customer ID. Please try again.' },
        { status: 500 }
      );
    }

    const { user, rawVerificationCode } = signupResult;

    // 5. Structured server logging (strictly omitting passwords, hashes, tokens, and secrets)
    console.log(
      `[${timestamp}] POST /api/auth/signup - Status: 201 - User created successfully - ID: ${user.id} - Customer ID: ${user.customerId} - Email: ${user.email} - Role: ${user.role} - Outbox: PENDING`
    );

    // Asynchronous non-blocking initial SMTP delivery attempt (does not delay registration response)
    sendVerificationEmailDirect({
      toEmail: user.email,
      code: rawVerificationCode,
      name: user.name || 'there',
    })
      .then((mailRes) => {
        if (!mailRes.success) {
          console.warn(
            `[${timestamp}] POST /api/auth/signup - SMTP Delivery Note: ${mailRes.error || 'Dispatch deferred'}`
          );
        } else {
          console.log(
            `[${timestamp}] POST /api/auth/signup - SMTP Email Sent Successfully - Message ID: ${mailRes.messageId}`
          );
        }
      })
      .catch((mailErr) => {
        console.warn(`[${timestamp}] Non-blocking SMTP dispatch note: ${mailErr?.message || 'deferred to outbox'}`);
      });

    // 6. Return registration response informing customer to verify email (NO session cookie issued)
    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful. Please check your email for your 6-digit verification code.',
        email: user.email,
        user: {
          id: user.id,
          customerId: user.customerId,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
        customerId: user.customerId,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[${timestamp}] POST /api/auth/signup - Status: 500 - Database write failed: ${errorMessage}`);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to connect to the database to create your account. Please try again later.',
      },
      { status: 500 }
    );
  }
}
