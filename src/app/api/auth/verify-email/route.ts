import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { inngest } from '@/inngest/client';
import {
  consumeVerificationCode,
  consumeVerificationToken,
  TokenNotFoundError,
  TokenExpiredError,
  TokenReusedError,
  TokenInvalidError,
} from '@/lib/tokens';

/**
 * POST /api/auth/verify-email
 *
 * Verifies a customer's email address using a single-use 6-digit verification code.
 *
 * Security & Functional Requirements (Task 4 Assessment):
 * - Accepts email and 6-digit numeric verification code in JSON body.
 * - Validates format (/^\d{6}$/).
 * - Hashes raw code with HMAC-SHA256 bound to user ID before comparison.
 * - Enforces single-use semantics: atomically updates AuthToken.usedAt and User.emailVerified.
 * - Concurrency protection: losing concurrent request throws TokenReusedError.
 * - Enforces 10-minute expiry on server.
 * - Rejects expired (410), already-used (409), and invalid (400) codes.
 * - Does NOT issue a session cookie or auto-login the user.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    let email: string | null = null;
    let code: string | null = null;
    let rawToken: string | null = null;

    try {
      const body = await request.json();
      if (body) {
        if (typeof body.email === 'string') email = body.email.trim();
        if (typeof body.code === 'string') code = body.code.trim();
        if (typeof body.token === 'string') {
          const t = body.token.trim();
          if (/^\d{6}$/.test(t)) {
            code = t;
          } else {
            rawToken = t;
          }
        }
      }
    } catch {
      // Body may be empty if params passed via URL
    }

    // Fallbacks from URL search params
    if (!email) {
      const queryEmail = request.nextUrl?.searchParams?.get('email');
      if (queryEmail) email = queryEmail.trim();
    }
    if (!code) {
      const queryCode = request.nextUrl?.searchParams?.get('code');
      if (queryCode && /^\d{6}$/.test(queryCode.trim())) {
        code = queryCode.trim();
      }
    }
    if (!rawToken && !code) {
      const queryToken = request.nextUrl?.searchParams?.get('token');
      if (queryToken) {
        const t = queryToken.trim();
        if (/^\d{6}$/.test(t)) {
          code = t;
        } else {
          rawToken = t;
        }
      }
    }

    // Branch A: Standard 6-digit verification code with email
    if (code) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          {
            success: false,
            code: 'INVALID_EMAIL',
            error: 'Please provide a valid email address.',
          },
          { status: 400 }
        );
      }

      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          {
            success: false,
            code: 'INVALID_CODE',
            error: 'Verification code must be exactly 6 numeric digits.',
          },
          { status: 400 }
        );
      }

      const result = await consumeVerificationCode(email, code, prisma);

      console.log(`[${timestamp}] POST /api/auth/verify-email - Status: 200 - Email verified successfully via 6-digit code`);

      // Dispatch welcome email background job if outbox record was created
      if (result.welcomeOutboxId) {
        try {
          await inngest.send({
            name: 'auth/welcome.email.requested',
            data: {
              outboxId: result.welcomeOutboxId,
              email: result.email,
              name: result.name || undefined,
            },
          });
          console.log(`[${timestamp}] POST /api/auth/verify-email - Inngest event dispatched for welcome outbox ID: ${result.welcomeOutboxId}`);
        } catch (inngestErr: any) {
          console.warn(`[${timestamp}] POST /api/auth/verify-email - Inngest dispatch failed for welcome outbox ID ${result.welcomeOutboxId}: ${inngestErr?.message || inngestErr}. Record remains PENDING for scheduled recovery.`);
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Your email address has been successfully verified. You may now sign in to your account.',
          verified: true,
        },
        { status: 200 }
      );
    }

    // Branch B: Legacy 64-char token fallback (if supplied)
    if (rawToken && /^[0-9a-fA-F]{64}$/.test(rawToken)) {
      const result = await consumeVerificationToken(rawToken, prisma);
      console.log(`[${timestamp}] POST /api/auth/verify-email - Status: 200 - Email verified successfully via token`);

      if (result.welcomeOutboxId) {
        try {
          await inngest.send({
            name: 'auth/welcome.email.requested',
            data: {
              outboxId: result.welcomeOutboxId,
              email: result.email,
              name: result.name || undefined,
            },
          });
          console.log(`[${timestamp}] POST /api/auth/verify-email - Inngest event dispatched for welcome outbox ID: ${result.welcomeOutboxId}`);
        } catch (inngestErr: any) {
          console.warn(`[${timestamp}] POST /api/auth/verify-email - Inngest dispatch failed for welcome outbox ID ${result.welcomeOutboxId}: ${inngestErr?.message || inngestErr}. Record remains PENDING for scheduled recovery.`);
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Your email address has been successfully verified. You may now sign in to your account.',
          verified: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'INVALID_CODE',
        error: 'Please enter your email and the 6-digit verification code.',
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.warn(`[${timestamp}] POST /api/auth/verify-email - Status: 410 - Code expired`);
      return NextResponse.json(
        {
          success: false,
          code: 'CODE_EXPIRED',
          error: 'This verification code has expired. Codes are valid for 10 minutes. Please request a new code.',
        },
        { status: 410 }
      );
    }

    if (error instanceof TokenReusedError) {
      console.warn(`[${timestamp}] POST /api/auth/verify-email - Status: 409 - Code already used`);
      return NextResponse.json(
        {
          success: false,
          code: 'CODE_REUSED',
          error: 'This verification code has already been used. Please sign in to your account.',
        },
        { status: 409 }
      );
    }

    if (error instanceof TokenNotFoundError) {
      console.warn(`[${timestamp}] POST /api/auth/verify-email - Status: 400 - Account not found`);
      return NextResponse.json(
        {
          success: false,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'No account found matching this email address.',
        },
        { status: 400 }
      );
    }

    if (error instanceof TokenInvalidError) {
      console.warn(`[${timestamp}] POST /api/auth/verify-email - Status: 400 - Invalid code`);
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_CODE',
          error: 'Invalid verification code. Please check the 6-digit code and try again.',
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[${timestamp}] POST /api/auth/verify-email - Status: 500 - Error: ${errorMessage}`);
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        error: 'Unable to verify your email at this time. Please try again later.',
      },
      { status: 500 }
    );
  }
}
