import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from '@node-rs/argon2';
import { signSessionToken, getSessionCookieOptions, generateRandomCustomerId } from '@/lib/auth';

// POST /api/auth/signup
// Handles customer registration with Argon2id password hashing and PostgreSQL persistence
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const body = await request.json();
    const { name, email, password, confirmPassword } = body;

    // 1. Server-side validation
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Validation failed: invalid name`);
      return NextResponse.json(
        { success: false, error: 'Full name must be between 2 and 100 characters.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Validation failed: invalid email format`);
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Validation failed: password too short`);
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const normalizedPassword = password.trim();
    if (normalizedPassword.length < 8) {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Validation failed: password too short`);
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    if (!confirmPassword || typeof confirmPassword !== 'string' || normalizedPassword !== confirmPassword.trim()) {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 400 - Validation failed: passwords do not match`);
      return NextResponse.json(
        { success: false, error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    // 2. Normalize inputs
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // 3. Duplicate email check
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      console.warn(`[${timestamp}] POST /api/auth/signup - Status: 409 - Email already registered: ${normalizedEmail}`);
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // 4. Secure Argon2id password hash (PRD FR-001 & BR-046)
    const passwordHash = await hash(normalizedPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // 5. Database write with unique 4-digit customer ID generation & collision retry
    // Client-supplied customer IDs are ignored; server always assigns a random 4-digit ID (1000-9999)
    let user = null;
    const MAX_RETRIES = 5;
    let attempts = 0;

    while (!user && attempts < MAX_RETRIES) {
      attempts++;
      const candidateCustomerId = generateRandomCustomerId();

      try {
        user = await prisma.user.create({
          data: {
            customerId: candidateCustomerId,
            name: trimmedName,
            email: normalizedEmail,
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
        throw err;
      }
    }

    if (!user) {
      console.error(`[${timestamp}] Failed to assign a unique customer ID after ${MAX_RETRIES} attempts.`);
      return NextResponse.json(
        { success: false, error: 'Unable to assign a unique customer ID. Please try again.' },
        { status: 500 }
      );
    }

    // 6. Issue secure server-side session cookie
    const token = signSessionToken({
      userId: user.id,
      customerId: user.customerId,
      role: user.role,
      sessionVersion: user.sessionVersion,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    // 7. Structured server logging (strictly omitting passwords, hashes, salts, and secrets)
    console.log(
      `[${timestamp}] POST /api/auth/signup - Status: 201 - User created successfully - ID: ${user.id} - Customer ID: ${user.customerId} - Email: ${user.email} - Role: ${user.role}`
    );

    const cookieOpts = getSessionCookieOptions();
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          customerId: user.customerId,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );

    response.cookies.set(cookieOpts.name, token, cookieOpts);

    return response;
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
