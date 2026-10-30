import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/auth/me
// Returns current authenticated user session or unauthenticated status
export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`GET /api/auth/me - Status: 500 - ${errorMessage}`);
    return NextResponse.json({ authenticated: false, user: null });
  }
}
