import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { initializeBookingPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate customer
    const user = await requireUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to initiate payment' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingReference, channel, callbackUrl } = body;

    if (!bookingReference || typeof bookingReference !== 'string') {
      return NextResponse.json(
        { error: 'Valid bookingReference is required' },
        { status: 400 }
      );
    }

    if (channel && channel !== 'card' && channel !== 'bank_transfer') {
      return NextResponse.json(
        { error: 'Channel must be either "card" or "bank_transfer"' },
        { status: 400 }
      );
    }

    // 2. Initialize payment with server-side validation & capacity hold check
    const result = await initializeBookingPayment({
      bookingReference,
      user: {
        id: user.id,
        email: user.email,
      },
      channel: channel || 'card',
      callbackUrl,
    });

    return NextResponse.json({
      success: true,
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference,
    });
  } catch (error: any) {
    console.error('Error in POST /api/payments/initialize:', error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      {
        error: error.message || 'Failed to initialize payment',
        code: error.code || 'PAYMENT_INITIALIZATION_FAILED',
      },
      { status }
    );
  }
}

