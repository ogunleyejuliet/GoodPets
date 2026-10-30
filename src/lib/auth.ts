import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE_NAME = 'goodpets_session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// Pre-computed valid Argon2id hash for constant-time comparison when email is not found
// Prevents user enumeration via timing discrepancies (PRD FR-003, BR-045)
export const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$WJ1l8aV9qEHzLg1h1vY6sC3bQ4qX5zW6yA7bC8dE9f0';

export interface SessionPayload {
  userId: string;
  role: string;
  sessionVersion: number;
  exp: number;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not configured in the environment. Please set AUTH_SECRET in .env.local or your deployment environment variables.'
    );
  }
  return secret;
}

export function signSessionToken(payload: SessionPayload): string {
  const secret = getAuthSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const secret = getAuthSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

/**
 * Server-side helper to verify the authenticated user from the session cookie.
 * In accordance with PRD 11.2 & BR-048, reads role, isActive, and sessionVersion
 * from the database to guarantee freshness and immediate session revocation.
 */
export async function requireUser(allowedRoles?: string[]) {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      sessionVersion: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  // Reject session if sessionVersion was incremented (e.g., password reset, BR-048)
  if (user.sessionVersion !== payload.sessionVersion) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  return user;
}

