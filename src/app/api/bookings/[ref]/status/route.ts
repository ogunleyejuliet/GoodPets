import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { confirmBookingPayment } from '@/lib/payments';
import { formatNaira } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { ref } = params;
    if (!ref) {
      return NextResponse.json(
        { error: 'Booking reference is required' },
        { status: 400 }
      );
    }

    // 1. Fetch booking with its payment
    let booking = await prisma.booking.findUnique({
      where: { reference: ref },
      include: {
        payment: true,
      },
    });

    // Data isolation (BR-032): Return 404 if booking doesn't exist or belongs to another customer
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.customerId !== user.id && user.role === 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // 2. If the booking is PENDING_PAYMENT and has an INITIATED payment,
    // or if a specific verifyReference was provided, attempt verification with Paystack
    const searchParams = request.nextUrl.searchParams;
    const requestedVerifyRef = searchParams.get('verifyReference');
    const latestPayment = booking.payment;

    const targetRef = requestedVerifyRef || (latestPayment?.status === 'INITIATED' ? latestPayment.reference : null);

    if (targetRef && booking.status === 'PENDING_PAYMENT') {
      try {
        const confirmResult = await confirmBookingPayment(targetRef);
        // Refresh booking data after confirmation attempt
        const updatedBooking = await prisma.booking.findUnique({
          where: { id: booking.id },
          include: {
            payment: true,
          },
        });
        if (updatedBooking) {
          booking = updatedBooking;
        }
      } catch (err) {
        // Verification failed or was still pending; continue and return current state
        console.warn(`Payment check for reference ${targetRef} completed with:`, err);
      }
    }

    const activePayment = booking.payment || null;

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        serviceType: booking.serviceType,
        groomingPackage: booking.groomingPackage,
        slotCode: booking.slotCode,
        startDate: booking.startDate.toISOString().split('T')[0],
        endDate: booking.endDate.toISOString().split('T')[0],
        quantity: booking.quantity,
        petNameSnapshot: booking.petNameSnapshot,
        petSpeciesSnapshot: booking.petSpeciesSnapshot,
        totalKobo: booking.totalKobo,
        formattedTotal: formatNaira(booking.totalKobo),
        currency: booking.currency,
        holdExpiresAt: booking.holdExpiresAt?.toISOString() || null,
        createdAt: booking.createdAt.toISOString(),
      },
      payment: activePayment
        ? {
            id: activePayment.id,
            reference: activePayment.reference,
            amountKobo: activePayment.amountKobo,
            status: activePayment.status,
            channel: activePayment.channel,
            paidAt: activePayment.paidAt?.toISOString() || null,
            gatewayResponse: activePayment.gatewayResponse,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error in GET /api/bookings/[ref]/status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve booking status' },
      { status: 500 }
    );
  }
}
