import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { calculatePrice, calculateDogSizeTier } from '@/lib/pricing';
import {
  GROOMING_SLOTS,
  getEarliestServiceDateLagos,
  isValidDateString,
  getDatesInRange,
  countDaycareDays,
  countBoardingNights,
} from '@/lib/dates';
import { ServiceType, GroomingPackage, Species } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to review bookings' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
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

    // 2. Validate Service Type
    if (!serviceType || !['GROOMING', 'DAYCARE', 'BOARDING'].includes(serviceType)) {
      return NextResponse.json(
        { error: 'Valid serviceType is required (GROOMING, DAYCARE, or BOARDING)' },
        { status: 400 }
      );
    }

    // 3. Confirm pet exists and belongs to the authenticated user (Data Isolation / Security)
    if (!petId || typeof petId !== 'string') {
      return NextResponse.json(
        { error: 'Valid petId is required' },
        { status: 400 }
      );
    }

    const pet = await prisma.pet.findFirst({
      where: {
        id: petId,
        ownerId: user.id,
        archivedAt: null,
      },
    });

    if (!pet) {
      return NextResponse.json(
        { error: 'Pet not found or does not belong to your account' },
        { status: 404 }
      );
    }

    const earliestDate = getEarliestServiceDateLagos();
    let startDate = '';
    let endDate = '';
    let quantity = 1;
    let quantityUnit = '';
    let scheduleInfo: Record<string, any> = {};
    let rescheduleDeadline = '';
    let latePickupNotice: string | null = null;

    // Service-specific validation & schedule configuration
    if (serviceType === 'GROOMING') {
      if (!groomingDate || !isValidDateString(groomingDate)) {
        return NextResponse.json(
          { error: 'Valid groomingDate (YYYY-MM-DD) is required' },
          { status: 400 }
        );
      }
      startDate = groomingDate;
      endDate = groomingDate;
      quantity = 1;
      quantityUnit = 'appointment (90 mins)';
      rescheduleDeadline = 'At least 2 days before the appointment (Africa/Lagos)';

      if (!groomingPackage || !['BASIC', 'FULL', 'PREMIUM'].includes(groomingPackage)) {
        return NextResponse.json(
          { error: 'Valid groomingPackage (BASIC, FULL, or PREMIUM) is required' },
          { status: 400 }
        );
      }

      if (pet.species === 'CAT' && groomingPackage === 'PREMIUM') {
        return NextResponse.json(
          { error: 'Premium Groom is not available for cats (FR-009)' },
          { status: 400 }
        );
      }

      if (pet.species === 'DOG') {
        if (pet.weightKg === null || Number(pet.weightKg) <= 0) {
          return NextResponse.json(
            { error: 'Dog weight is required to determine grooming size tier (BR-003, FR-005)' },
            { status: 400 }
          );
        }
      }

      const slotConfig = GROOMING_SLOTS.find((s) => s.slotCode === groomingSlot);
      if (!slotConfig) {
        return NextResponse.json(
          { error: 'Valid groomingSlot (09:00, 12:00, or 15:00) is required' },
          { status: 400 }
        );
      }

      scheduleInfo = {
        appointmentDate: groomingDate,
        slotCode: slotConfig.slotCode,
        startTime: slotConfig.startTime,
        endTime: slotConfig.endTime,
        durationMinutes: 90,
        appointmentHours: slotConfig.label,
        groomingPackage,
      };
    } else if (serviceType === 'DAYCARE') {
      startDate = daycareStartDate;
      endDate = daycareMode === 'single' ? daycareStartDate : daycareEndDate;

      if (!startDate || !isValidDateString(startDate) || !endDate || !isValidDateString(endDate)) {
        return NextResponse.json(
          { error: 'Valid daycare start and end dates (YYYY-MM-DD) are required' },
          { status: 400 }
        );
      }

      if (endDate < startDate) {
        return NextResponse.json(
          { error: 'Daycare end date cannot be before start date' },
          { status: 400 }
        );
      }

      quantity = countDaycareDays(startDate, endDate);
      if (quantity <= 0) {
        return NextResponse.json(
          { error: 'Daycare requires at least 1 day' },
          { status: 400 }
        );
      }
      quantityUnit = quantity === 1 ? 'calendar day' : 'calendar days';
      rescheduleDeadline = 'At least 1 day before the booked date (Africa/Lagos)';
      latePickupNotice = 'Daycare runs 8:00 AM – 8:00 PM. Pickups after 8:00 PM incur a ₦5,000 late penalty payable in cash at the counter (BR-029).';

      scheduleInfo = {
        mode: daycareMode === 'single' ? 'single' : 'range',
        startDate,
        endDate,
        totalDays: quantity,
        operatingHours: '8:00 AM – 8:00 PM',
      };
    } else if (serviceType === 'BOARDING') {
      startDate = boardingCheckIn;
      endDate = boardingCheckOut;

      if (!startDate || !isValidDateString(startDate) || !endDate || !isValidDateString(endDate)) {
        return NextResponse.json(
          { error: 'Valid boarding check-in and check-out dates (YYYY-MM-DD) are required' },
          { status: 400 }
        );
      }

      if (endDate <= startDate) {
        return NextResponse.json(
          { error: 'Boarding requires at least 1 night (check-out must be after check-in)' },
          { status: 400 }
        );
      }

      quantity = countBoardingNights(startDate, endDate);
      if (quantity <= 0) {
        return NextResponse.json(
          { error: 'Boarding stay must be at least 1 night' },
          { status: 400 }
        );
      }
      quantityUnit = quantity === 1 ? 'night' : 'nights';
      rescheduleDeadline = 'At least 2 days before check-in (Africa/Lagos)';

      scheduleInfo = {
        checkInDate: startDate,
        checkOutDate: endDate,
        totalNights: quantity,
        checkInWindow: 'From 8:00 PM',
        checkOutWindow: 'By 8:00 AM',
        stayWindow: '8:00 PM – 8:00 AM',
        kennelRule: 'The check-out day does not use a kennel space (BR-010)',
      };
    }

    // 4. Validate Minimum Booking Lead Time (BR-043: earliest date is tomorrow)
    if (startDate < earliestDate) {
      return NextResponse.json(
        {
          error: `Appointments must be booked at least one day in advance. Earliest available date is ${earliestDate}.`,
          code: 'EARLIEST_DATE_VIOLATION',
          earliestDate,
        },
        { status: 400 }
      );
    }

    // 5. Server-side Availability & Closures Re-check
    const rangeStartUtc = new Date(`${startDate}T00:00:00.000Z`);
    const rangeEndUtc = new Date(`${endDate}T00:00:00.000Z`);

    // Check closures
    const closures = await prisma.closure.findMany({
      where: {
        AND: [
          {
            OR: [
              { serviceType: null },
              { serviceType: serviceType as ServiceType },
            ],
          },
          { startDate: { lte: rangeEndUtc } },
          { endDate: { gte: rangeStartUtc } },
        ],
      },
    });

    const isDateClosed = (dStr: string) => {
      const dUtc = new Date(`${dStr}T00:00:00.000Z`);
      return closures.find((c) => c.startDate <= dUtc && c.endDate >= dUtc);
    };

    // Check capacity units
    const config = await prisma.serviceConfig.findUnique({
      where: { serviceType: serviceType as ServiceType },
    });

    const defaultCapacity =
      config?.defaultCapacity ??
      (serviceType === 'GROOMING' ? 2 : serviceType === 'DAYCARE' ? 20 : 16);

    const capacityUnits = await prisma.capacityUnit.findMany({
      where: {
        serviceType: serviceType as ServiceType,
        serviceDate: {
          gte: rangeStartUtc,
          lte: rangeEndUtc,
        },
      },
      include: {
        bookingUnits: {
          where: {
            releasedAt: null,
            booking: {
              status: 'PENDING_PAYMENT',
              holdExpiresAt: { lt: new Date() },
            },
          },
        },
      },
    });

    const capacityMap = new Map<string, { capacity: number; reserved: number; expiredCount: number }>();
    for (const unit of capacityUnits) {
      const dStr = unit.serviceDate.toISOString().split('T')[0];
      const key = `${dStr}_${unit.slotCode}`;
      capacityMap.set(key, {
        capacity: unit.capacity,
        reserved: unit.reserved,
        expiredCount: unit.bookingUnits.length,
      });
    }

    const checkUnitCapacity = (dStr: string, slotCode: string) => {
      const closure = isDateClosed(dStr);
      if (closure) {
        return { available: false, reason: closure.message || 'Facility closed on this date' };
      }
      const key = `${dStr}_${slotCode}`;
      const record = capacityMap.get(key);
      const cap = record ? record.capacity : defaultCapacity;
      const res = record ? record.reserved : 0;
      const exp = record ? record.expiredCount : 0;
      const effReserved = Math.max(0, res - exp);
      const openPlaces = cap - effReserved;
      if (openPlaces <= 0) {
        return { available: false, reason: 'Capacity full' };
      }
      return { available: true };
    };

    // Verify availability for each required unit
    if (serviceType === 'GROOMING') {
      const check = checkUnitCapacity(startDate, groomingSlot);
      if (!check.available) {
        return NextResponse.json(
          {
            error: `The selected grooming appointment (${startDate} at ${groomingSlot}) is no longer available: ${check.reason}. Please select another slot.`,
            code: 'CAPACITY_UNAVAILABLE',
          },
          { status: 409 }
        );
      }
    } else if (serviceType === 'DAYCARE') {
      const dates = getDatesInRange(startDate, endDate);
      for (const dStr of dates) {
        const check = checkUnitCapacity(dStr, 'DAY');
        if (!check.available) {
          return NextResponse.json(
            {
              error: `Daycare on ${dStr} is no longer available (${check.reason}). Please select alternative dates.`,
              code: 'CAPACITY_UNAVAILABLE',
              unavailableDate: dStr,
            },
            { status: 409 }
          );
        }
      }
    } else if (serviceType === 'BOARDING') {
      // Boarding nights: startDate through day before endDate
      const nightDates = getDatesInRange(
        startDate,
        new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() - 86400000)
          .toISOString()
          .split('T')[0]
      );
      for (const nStr of nightDates) {
        const check = checkUnitCapacity(nStr, 'NIGHT');
        if (!check.available) {
          return NextResponse.json(
            {
              error: `Boarding kennel on ${nStr} is no longer available (${check.reason}). Please select alternative dates.`,
              code: 'CAPACITY_UNAVAILABLE',
              unavailableNight: nStr,
            },
            { status: 409 }
          );
        }
      }
    }

    // 6. Trusted Server-side Price & 2% Tax Calculation
    const petWeight = pet.weightKg !== null ? Number(pet.weightKg) : null;
    const dogSizeTier = pet.species === 'DOG' ? calculateDogSizeTier(petWeight) : null;

    const priceResult = calculatePrice({
      serviceType: serviceType as ServiceType,
      species: pet.species as Species,
      weightKg: petWeight,
      groomingPackage: groomingPackage as GroomingPackage,
      quantity,
      includeTax: true,
    });

    // 7. Assemble Verified Booking Review Payload
    return NextResponse.json({
      success: true,
      review: {
        serviceType,
        pet: {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed || 'Not specified',
          weightKg: petWeight,
          formattedWeight: petWeight !== null ? `${petWeight} kg` : null,
          sizeTier: dogSizeTier,
          careNotes: pet.careNotes || null,
        },
        schedule: scheduleInfo,
        pricing: {
          unitPriceKobo: priceResult.unitPriceKobo,
          quantity: priceResult.quantity,
          quantityUnit,
          subtotalKobo: priceResult.subtotalKobo,
          taxKobo: priceResult.taxKobo,
          taxRatePercent: priceResult.taxRatePercent,
          totalKobo: priceResult.totalWithTaxKobo,
          formattedUnitPrice: priceResult.formattedUnitPrice,
          formattedSubtotal: priceResult.formattedSubtotal,
          formattedTax: priceResult.formattedTax,
          formattedTotal: priceResult.formattedTotalWithTax,
        },
        policies: {
          cancellation: 'No cancellations or refunds exist for confirmed bookings (BR-019).',
          rescheduling: 'Rescheduling is permitted only to a future available date with no price penalty.',
          rescheduleDeadline,
          vaccinationNotice: 'Please bring valid DHPP (dogs) or FVRCP (cats) vaccination evidence in person.',
          latePickupNotice,
        },
        disclaimer: 'This is an estimated booking quote. Capacity is not reserved until payment hold is initiated in Stage 4.',
      },
    });
  } catch (error: any) {
    console.error('Error validating booking review:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error validating booking review' },
      { status: 500 }
    );
  }
}
