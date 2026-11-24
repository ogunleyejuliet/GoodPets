import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verify } from '@node-rs/argon2';
import {
  signSessionToken,
  getSessionCookieOptions,
} from '@/lib/auth';
import {
  getClientIp,
  deriveRateLimitKey,
  reserveRateLimits,
  decrementRateLimits,
  redactKeyForLog,
  ReservedRateLimit,
  RateLimitClientIpError,
  RateLimitExceededError,
  RateLimitConfigError,
  RateLimitUnavailableError,
} from '@/lib/rate-limit';

// Valid pre-computed Argon2id dummy hash using application parameters (m=19456, t=2, p=1)
const VALID_DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$XtMpH3NFCda15Hxxh1NdDQ$+vzJvzMP9Bj1hvbJnd2w1dcBNP5Dr+Y8NQb63nQJqps';

// POST /api/auth/signin
// Authenticates a customer against PostgreSQL with Argon2id and sets a secure HTTP-only session cookie
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const body = await request.json();
    const { email, customerId, password } = body;

    // 1. Validation
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required.' },
        { status: 400 }
      );
    }

    const normalizedPassword = password.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // 1b. Transactional rate-limit reservation (BR-049: 5 failed/15m/email, 20 failed/15m/IP)
    let reservations: ReservedRateLimit[] = [];
    try {
      const clientIp = getClientIp(request);
      const emailKey = deriveRateLimitKey('signin:email', normalizedEmail);
      const ipKey = deriveRateLimitKey('signin:ip', clientIp);

      reservations = await reserveRateLimits([
        { key: emailKey, limit: 5, windowSeconds: 900 },
        { key: ipKey, limit: 20, windowSeconds: 900 },
      ]);
    } catch (rlError) {
      if (rlError instanceof RateLimitClientIpError) {
        return NextResponse.json(
          { success: false, error: rlError.message },
          { status: 400 }
        );
      }
      if (rlError instanceof RateLimitExceededError) {
        await verify(VALID_DUMMY_ARGON2_HASH, normalizedPassword).catch(() => false);
        console.warn(`[${timestamp}] POST /api/auth/signin - Status: 429 - Rate limit exceeded`);
        return NextResponse.json(
          {
            success: false,
            error: 'Too many failed sign-in attempts. Please try again later.',
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

    // 2. Query user from database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        customerId: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        isActive: true,
        sessionVersion: true,
        emailVerified: true,
      },
    });

    if (!user || !user.passwordHash) {
      // Run dummy verification to prevent timing attacks / user enumeration (PRD FR-003, BR-045)
      await verify(VALID_DUMMY_ARGON2_HASH, normalizedPassword).catch(() => false);
      return NextResponse.json(
        { success: false, error: 'Invalid Customer ID or password.' },
        { status: 401 }
      );
    }

    // 3. For customers, require a valid 4-digit Customer ID matching the account
    if (user.role === 'CUSTOMER') {
      const isFormatValid =
        typeof customerId === 'string' && /^\d{4}$/.test(customerId.trim());
      const isMatch =
        isFormatValid &&
        Boolean(user.customerId) &&
        user.customerId === customerId.trim();

      if (!isMatch) {
        // Run dummy verification to prevent timing attacks / user enumeration
        await verify(VALID_DUMMY_ARGON2_HASH, normalizedPassword).catch(() => false);
        return NextResponse.json(
          { success: false, error: 'Invalid Customer ID or password.' },
          { status: 401 }
        );
      }
    }

    // 4. Verify Argon2id password hash
    const isValid = await verify(user.passwordHash, normalizedPassword);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid Customer ID or password.' },
        { status: 401 }
      );
    }

    // 5. Check customer email verification status (FR-003, BR-047)
    // Staff roles (FRONT_DESK, MANAGER) are exempt from customer email verification
    if (user.role === 'CUSTOMER' && !user.emailVerified) {
      console.warn(
        `[${timestamp}] POST /api/auth/signin - Status: 403 - Unverified customer sign-in rejected - UserID: ${user.id}`
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Verify your email first.',
          code: 'EMAIL_NOT_VERIFIED',
          verificationUrl: '/auth/verify',
        },
        { status: 403 }
      );
    }

    // 6. Verify account active state
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // 6b. Authentication succeeded: roll back speculative failed-attempt reservations
    try {
      await decrementRateLimits(reservations);
    } catch (cleanupError) {
      const cleanupMsg =
        cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error';
      console.error(
        `[${timestamp}] POST /api/auth/signin - RateLimit cleanup failed after authentication - UserID: ${user.id} - Keys: [${reservations.map((r) => redactKeyForLog(r.key)).join(', ')}] - Error: ${cleanupMsg}`
      );
    }

    // 6. Issue session cookie
    const token = signSessionToken({
      userId: user.id,
      customerId: user.customerId,
      role: user.role,
      sessionVersion: user.sessionVersion,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    console.log(
      `[${timestamp}] POST /api/auth/signin - Status: 200 - User signed in successfully - ID: ${user.id} - Role: ${user.role}`
    );

    const cookieOpts = getSessionCookieOptions();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        customerId: user.customerId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(cookieOpts.name, token, cookieOpts);

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${timestamp}] POST /api/auth/signin - Status: 500 - ${errorMessage}`);
    return NextResponse.json(
      { success: false, error: 'Unable to sign in at this time. Please try again.' },
      { status: 500 }
    );
  }
}

