import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createBookingWithCapacityHold } from '@/lib/capacity';
import { formatNaira } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate customer
    const user = await requireUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to create a booking' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      idempotencyKey,
      petId,
      serviceType,
      groomingPackage,
      groomingDate,
      groomingSlot,
      daycareMode,
      daycareStartDate,
      daycareEndDate,
      boardingCheckIn,
      boardingCheckOut,
    } = body;

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'idempotencyKey is required for booking creation' },
        { status: 400 }
      );
    }

    // 2. Execute Atomic Capacity Hold & Booking Creation inside transaction
    const result = await createBookingWithCapacityHold({
      customerId: user.id,
      idempotencyKey,
      petId,
      serviceType,
      groomingPackage,
      groomingDate,
      groomingSlot,
      daycareMode,
      daycareStartDate,
      daycareEndDate,
      boardingCheckIn,
      boardingCheckOut,
    });

    const booking = result.booking;

    return NextResponse.json(
      {
        success: true,
        isExisting: result.isExisting,
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
          petWeightKgSnapshot: booking.petWeightKgSnapshot !== null ? Number(booking.petWeightKgSnapshot) : null,
          sizeTierSnapshot: booking.sizeTierSnapshot,
          unitPriceKobo: booking.unitPriceKobo,
          totalKobo: booking.totalKobo,
          formattedUnitPrice: formatNaira(booking.unitPriceKobo),
          formattedTotal: formatNaira(booking.totalKobo),
          currency: booking.currency,
          holdExpiresAt: booking.holdExpiresAt?.toISOString() || null,
          createdAt: booking.createdAt.toISOString(),
        },
      },
      { status: result.isExisting ? 200 : 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/bookings:', error);
    const status = error.statusCode || 400;
    return NextResponse.json(
      {
        error: error.message || 'An error occurred while creating your booking',
        code: error.code || 'BOOKING_CREATION_FAILED',
      },
      { status }
    );
  }
}

