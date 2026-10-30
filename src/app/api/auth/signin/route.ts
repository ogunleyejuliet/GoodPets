import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verify } from '@node-rs/argon2';
import {
  signSessionToken,
  getSessionCookieOptions,
  DUMMY_ARGON2_HASH,
} from '@/lib/auth';

// POST /api/auth/signin
// Authenticates a customer against PostgreSQL with Argon2id and sets a secure HTTP-only session cookie
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const body = await request.json();
    const { email, password } = body;

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

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Query user from database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      // Run dummy verification to prevent timing attacks / user enumeration (PRD FR-003, BR-045)
      await verify(DUMMY_ARGON2_HASH, password).catch(() => false);
      return NextResponse.json(
        { success: false, error: 'Email or password is incorrect.' },
        { status: 401 }
      );
    }

    // 3. Verify Argon2id password hash
    const isValid = await verify(user.passwordHash, password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Email or password is incorrect.' },
        { status: 401 }
      );
    }

    // 4. Verify account active state
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // 5. Issue session cookie
    const token = signSessionToken({
      userId: user.id,
      role: user.role,
      sessionVersion: user.sessionVersion,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    console.log(
      `[${timestamp}] POST /api/auth/signin - Status: 200 - User signed in successfully - ID: ${user.id} - Email: ${user.email} - Role: ${user.role}`
    );

    const cookieOpts = getSessionCookieOptions();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
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

