import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  GROOMING_SLOTS,
  getEarliestServiceDateLagos,
  isValidDateString,
  getDatesInRange,
  countDaycareDays,
  countBoardingNights,
} from '@/lib/dates';
import { ServiceType } from '@prisma/client';

// Rate limit helper: BR-039 specifies 60 requests per minute per IP for availability
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 60) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service')?.toUpperCase() as ServiceType | undefined;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate') || startDate;
  const species = searchParams.get('species')?.toUpperCase();

  // Validate service
  if (!service || !['GROOMING', 'DAYCARE', 'BOARDING'].includes(service)) {
    return NextResponse.json(
      { error: 'Valid service is required (GROOMING, DAYCARE, or BOARDING)' },
      { status: 400 }
    );
  }

  // Validate dates
  if (!startDate || !isValidDateString(startDate)) {
    return NextResponse.json(
      { error: 'startDate is required in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  if (!endDate || !isValidDateString(endDate)) {
    return NextResponse.json(
      { error: 'endDate must be in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  // BR-043: Earliest service date is the next Lagos calendar day. Same-day & past dates are blocked.
  const earliestDate = getEarliestServiceDateLagos();
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

  // Date range logic
  if (service === 'DAYCARE' && endDate < startDate) {
    return NextResponse.json(
      { error: 'endDate cannot be before startDate' },
      { status: 400 }
    );
  }

  if (service === 'BOARDING' && endDate <= startDate) {
    return NextResponse.json(
      { error: 'Boarding requires at least 1 night (check-out date must be after check-in date)' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch ServiceConfig for default capacity & slot configuration
    const config = await prisma.serviceConfig.findUnique({
      where: { serviceType: service },
    });

    const defaultCapacity =
      config?.defaultCapacity ??
      (service === 'GROOMING' ? 2 : service === 'DAYCARE' ? 20 : 16);

    // 2. Query Closures covering the requested date range (BR-024)
    // Range comparison: closure.startDate <= endDate AND closure.endDate >= startDate
    const rangeStartUtc = new Date(`${startDate}T00:00:00.000Z`);
    const rangeEndUtc = new Date(`${endDate}T00:00:00.000Z`);

    const closures = await prisma.closure.findMany({
      where: {
        AND: [
          {
            OR: [
              { serviceType: null },
              { serviceType: service },
            ],
          },
          { startDate: { lte: rangeEndUtc } },
          { endDate: { gte: rangeStartUtc } },
        ],
      },
    });

    // Helper: is a specific date closed?
    const getClosureForDate = (dateStr: string) => {
      const dateUtc = new Date(`${dateStr}T00:00:00.000Z`);
      return closures.find((c) => c.startDate <= dateUtc && c.endDate >= dateUtc);
    };

    // 3. Query existing CapacityUnit records and unreleased expired holds
    const capacityUnits = await prisma.capacityUnit.findMany({
      where: {
        serviceType: service,
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

    // Map: key `${serviceDateStr}_${slotCode}` -> { capacity, reserved, expiredHolds }
    const capacityMap = new Map<
      string,
      { capacity: number; reserved: number; expiredHoldsCount: number }
    >();

    for (const unit of capacityUnits) {
      const dateStr = unit.serviceDate.toISOString().split('T')[0];
      const key = `${dateStr}_${unit.slotCode}`;
      capacityMap.set(key, {
        capacity: unit.capacity,
        reserved: unit.reserved,
        expiredHoldsCount: unit.bookingUnits.length,
      });
    }

    // Helper to evaluate unit availability:
    // FR-008: capacity minus reserved, plus places held by expired holds that have not yet been released
    const isSlotAvailable = (dateStr: string, slotCode: string) => {
      const closure = getClosureForDate(dateStr);
      if (closure) {
        return { available: false, reason: closure.message || 'Facility closed on this date' };
      }

      const key = `${dateStr}_${slotCode}`;
      const record = capacityMap.get(key);
      const capacity = record ? record.capacity : defaultCapacity;
      const reserved = record ? record.reserved : 0;
      const expiredCount = record ? record.expiredHoldsCount : 0;

      const effectiveReserved = Math.max(0, reserved - expiredCount);
      const placesRemaining = capacity - effectiveReserved;

      if (placesRemaining <= 0) {
        return { available: false, reason: 'Fully booked' };
      }
      return { available: true };
    };

    // Service-specific responses
    if (service === 'GROOMING') {
      const slotsResult = GROOMING_SLOTS.map((slot) => {
        const check = isSlotAvailable(startDate, slot.slotCode);
        return {
          slotCode: slot.slotCode,
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: slot.label,
          durationMinutes: slot.durationMinutes,
          available: check.available,
          reason: check.reason,
        };
      });

      const anySlotAvailable = slotsResult.some((s) => s.available);

      return NextResponse.json(
        {
          service: 'GROOMING',
          date: startDate,
          available: anySlotAvailable,
          slots: slotsResult,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=10',
          },
        }
      );
    }

    if (service === 'DAYCARE') {
      const dates = getDatesInRange(startDate, endDate);
      const totalDays = countDaycareDays(startDate, endDate);

      const daysResult = dates.map((dateStr) => {
        const check = isSlotAvailable(dateStr, 'DAY');
        return {
          date: dateStr,
          available: check.available,
          reason: check.reason,
        };
      });

      const allDaysAvailable = daysResult.every((d) => d.available);
      const firstFullDay = daysResult.find((d) => !d.available);

      return NextResponse.json(
        {
          service: 'DAYCARE',
          startDate,
          endDate,
          totalDays,
          available: allDaysAvailable,
          firstUnavailableDate: firstFullDay?.date,
          days: daysResult,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=10',
          },
        }
      );
    }

    if (service === 'BOARDING') {
      // Boarding: BR-010 nights = check-out minus check-in.
      // Nights belong to dates startDate to the day BEFORE endDate.
      const totalNights = countBoardingNights(startDate, endDate);
      const nightDates = getDatesInRange(
        startDate,
        // day before endDate
        new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() - 86400000)
          .toISOString()
          .split('T')[0]
      );

      const nightsResult = nightDates.map((dateStr) => {
        const check = isSlotAvailable(dateStr, 'NIGHT');
        return {
          nightDate: dateStr,
          available: check.available,
          reason: check.reason,
        };
      });

      const allNightsAvailable = nightsResult.every((n) => n.available);
      const firstFullNight = nightsResult.find((n) => !n.available);

      return NextResponse.json(
        {
          service: 'BOARDING',
          checkInDate: startDate,
          checkOutDate: endDate,
          totalNights,
          available: allNightsAvailable,
          firstUnavailableNight: firstFullNight?.nightDate,
          nights: nightsResult,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=10',
          },
        }
      );
    }

    return NextResponse.json({ error: 'Unsupported service' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'An error occurred while calculating availability' },
      { status: 500 }
    );
  }
}

