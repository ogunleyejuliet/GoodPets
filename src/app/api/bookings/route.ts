import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createBookingWithCapacityHold } from '@/lib/capacity';
import { formatNaira } from '@/lib/pricing';
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

    // 1b. Transactional rate-limit reservation (BR-039: 10/hr per user, 20/hr per IP)
    let reservations: ReservedRateLimit[] = [];
    try {
      const clientIp = getClientIp(request);
      const userKey = deriveRateLimitKey('booking:user', user.id);
      const ipKey = deriveRateLimitKey('booking:ip', clientIp);

      reservations = await reserveRateLimits([
        { key: userKey, limit: 10, windowSeconds: 3600 },
        { key: ipKey, limit: 20, windowSeconds: 3600 },
      ]);
    } catch (rlError) {
      if (rlError instanceof RateLimitClientIpError) {
        return NextResponse.json(
          { error: rlError.message },
          { status: 400 }
        );
      }
      if (rlError instanceof RateLimitExceededError) {
        return NextResponse.json(
          {
            error: 'Too many booking requests. Please wait before creating another booking.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rlError.retryAfterSeconds) },
          }
        );
      }
      if (rlError instanceof RateLimitConfigError || rlError instanceof RateLimitUnavailableError) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      throw rlError;
    }

    // 2. Execute Atomic Capacity Hold & Booking Creation inside transaction
    let result;
    try {
      result = await createBookingWithCapacityHold({
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
    } catch (bookingError) {
      try {
        await decrementRateLimits(reservations);
      } catch (cleanupError) {
        const cleanupMsg =
          cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error';
        console.error(
          `POST /api/bookings - RateLimit rollback failed after booking error - UserID: ${user.id} - Keys: [${reservations.map((r) => redactKeyForLog(r.key)).join(', ')}] - Error: ${cleanupMsg}`
        );
      }
      throw bookingError;
    }

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

