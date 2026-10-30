import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser, getSessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/signout
// Invalidates active session on the server via sessionVersion increment (BR-048) and clears the cookie
export async function POST() {
  try {
    const user = await requireUser();

    // If an active user session was found, invalidate it on the server
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          sessionVersion: { increment: 1 },
        },
      });
      console.log(`POST /api/auth/signout - Invalidated session for user: ${user.id} (sessionVersion incremented)`);
    }

    const cookieOpts = getSessionCookieOptions();
    const response = NextResponse.json({ success: true, message: 'Signed out successfully' });

    // Clear session cookie in browser
    response.cookies.set(cookieOpts.name, '', {
      ...cookieOpts,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`POST /api/auth/signout - Error: ${errorMessage}`);
    const cookieOpts = getSessionCookieOptions();
    const response = NextResponse.json({ success: true, message: 'Signed out' });
    response.cookies.set(cookieOpts.name, '', {
      ...cookieOpts,
      maxAge: 0,
    });
    return response;
  }
}
