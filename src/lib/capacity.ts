// Good Pets - Atomic Capacity & Booking Module
// Single Source of Truth: PRD section 7.3 (FR-013), section 8.5 (BR-008, BR-009, BR-010, BR-011, BR-012, BR-017, BR-038, BR-041, BR-042, BR-043)

import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import { calculatePrice, calculateDogSizeTier } from '@/lib/pricing';
import {
  GROOMING_SLOTS,
  getEarliestServiceDateLagos,
  isValidDateString,
  getDatesInRange,
  countDaycareDays,
  countBoardingNights,
} from '@/lib/dates';
import { ServiceType, GroomingPackage, Species, Booking, Prisma } from '@prisma/client';

export const HOLD_DURATION_MINUTES = 10; // BR-017: 10 minutes hold
export const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // BR-038: no 0, 1, I, O

/**
 * BR-038: Generates a unique booking reference: GP- followed by 6 characters from REFERENCE_ALPHABET.
 */
export function generateBookingReference(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, REFERENCE_ALPHABET.length);
    code += REFERENCE_ALPHABET[randomIndex];
  }
  return `GP-${code}`;
}

export interface CreateBookingParams {
  customerId: string;
  idempotencyKey: string;
  petId: string;
  serviceType: ServiceType;
  groomingPackage?: GroomingPackage;
  groomingDate?: string;
  groomingSlot?: string;
  daycareMode?: 'single' | 'range';
  daycareStartDate?: string;
  daycareEndDate?: string;
  boardingCheckIn?: string;
  boardingCheckOut?: string;
}

export interface BookingCreationResult {
  booking: Booking;
  isExisting: boolean;
}

/**
 * Releases unreleased booking units for expired PENDING_PAYMENT bookings.
 * Idempotent, safe, and does not interfere with active bookings (BR-012, BR-013).
 */
export async function releaseExpiredHolds(): Promise<number> {
  const now = new Date();

  // Find unreleased booking units belonging to expired bookings
  const expiredUnits = await prisma.bookingUnit.findMany({
    where: {
      releasedAt: null,
      booking: {
        status: 'PENDING_PAYMENT',
        holdExpiresAt: { lt: now },
      },
    },
    include: {
      booking: { select: { id: true, status: true } },
      capacityUnit: true,
    },
  });

  if (expiredUnits.length === 0) return 0;

  let releasedCount = 0;
  for (const bu of expiredUnits) {
    try {
      await prisma.$transaction(async (tx) => {
        // Mark unit as released
        await tx.bookingUnit.update({
          where: { id: bu.id },
          data: { releasedAt: now },
        });

        // Safely decrement reserved counter
        await tx.$executeRaw`
          UPDATE "CapacityUnit"
          SET "reserved" = GREATEST(0, "reserved" - 1)
          WHERE "id" = ${bu.capacityUnitId}
        `;

        // Mark booking as EXPIRED if all its units are released
        await tx.booking.updateMany({
          where: {
            id: bu.bookingId,
            status: 'PENDING_PAYMENT',
            holdExpiresAt: { lt: now },
          },
          data: { status: 'EXPIRED' },
        });
      });
      releasedCount++;
    } catch (e) {
      console.error(`Failed to release expired unit ${bu.id}:`, e);
    }
  }

  return releasedCount;
}

/**
 * Creates a booking and locks capacity units inside a single atomic database transaction.
 * Implements FR-013, BR-008 to BR-013, BR-038, BR-041, BR-042, BR-043.
 */
export async function createBookingWithCapacityHold(
  params: CreateBookingParams
): Promise<BookingCreationResult> {
  const {
    customerId,
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
  } = params;

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new Error('Valid idempotencyKey is required (FR-013)');
  }

  // 1. Idempotency Check: if request with this key already exists for this customer
  const existingBooking = await prisma.booking.findUnique({
    where: {
      customerId_idempotencyKey: {
        customerId,
        idempotencyKey,
      },
    },
  });

  if (existingBooking) {
    // Check if parameters match
    const isSameService = existingBooking.serviceType === serviceType;
    const isSamePet = existingBooking.petId === petId;
    if (isSameService && isSamePet) {
      return { booking: existingBooking, isExisting: true };
    }
    const err: any = new Error('Idempotency key has already been used with different booking parameters');
    err.code = 'IDEMPOTENCY_CONFLICT';
    err.statusCode = 409;
    throw err;
  }

  // 2. Validate Pet Ownership (Data Isolation)
  const pet = await prisma.pet.findFirst({
    where: {
      id: petId,
      ownerId: customerId,
      archivedAt: null,
    },
  });

  if (!pet) {
    const err: any = new Error('Pet not found or does not belong to you');
    err.statusCode = 404;
    throw err;
  }

  // 3. Service-Specific Validation & Schedule Setup
  const earliestDate = getEarliestServiceDateLagos();
  let startDate = '';
  let endDate = '';
  let quantity = 1;
  let requiredUnits: Array<{ serviceDate: string; slotCode: string }> = [];

  if (serviceType === 'GROOMING') {
    if (!groomingDate || !isValidDateString(groomingDate)) {
      throw new Error('Valid groomingDate (YYYY-MM-DD) is required');
    }
    if (!groomingPackage || !['BASIC', 'FULL', 'PREMIUM'].includes(groomingPackage)) {
      throw new Error('Valid groomingPackage is required');
    }
    if (pet.species === 'CAT' && groomingPackage === 'PREMIUM') {
      throw new Error('Premium Groom is not available for cats (FR-009)');
    }
    if (pet.species === 'DOG' && (!pet.weightKg || Number(pet.weightKg) <= 0)) {
      throw new Error('Dog weight is required for grooming booking (BR-003, FR-005)');
    }
    const slotConfig = GROOMING_SLOTS.find((s) => s.slotCode === groomingSlot);
    if (!slotConfig) {
      throw new Error('Valid groomingSlot (09:00, 12:00, or 15:00) is required');
    }

    startDate = groomingDate;
    endDate = groomingDate;
    quantity = 1;
    requiredUnits.push({ serviceDate: groomingDate, slotCode: slotConfig.slotCode });
  } else if (serviceType === 'DAYCARE') {
    startDate = daycareStartDate || '';
    endDate = daycareMode === 'single' ? startDate : daycareEndDate || '';
    if (!startDate || !isValidDateString(startDate) || !endDate || !isValidDateString(endDate)) {
      throw new Error('Valid daycare start and end dates are required');
    }
    if (endDate < startDate) {
      throw new Error('Daycare end date cannot be before start date');
    }
    quantity = countDaycareDays(startDate, endDate);
    if (quantity <= 0) {
      throw new Error('Daycare requires at least 1 day');
    }
    const dates = getDatesInRange(startDate, endDate);
    for (const d of dates) {
      requiredUnits.push({ serviceDate: d, slotCode: 'DAY' });
    }
  } else if (serviceType === 'BOARDING') {
    startDate = boardingCheckIn || '';
    endDate = boardingCheckOut || '';
    if (!startDate || !isValidDateString(startDate) || !endDate || !isValidDateString(endDate)) {
      throw new Error('Valid boarding check-in and check-out dates are required');
    }
    if (endDate <= startDate) {
      throw new Error('Boarding requires at least 1 night (check-out must be after check-in)');
    }
    quantity = countBoardingNights(startDate, endDate);
    if (quantity <= 0) {
      throw new Error('Boarding stay must be at least 1 night');
    }
    // BR-010: Boarding night belongs to the date it starts. Check-out day does not use a kennel.
    const nightDates = getDatesInRange(
      startDate,
      new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() - 86400000)
        .toISOString()
        .split('T')[0]
    );
    for (const n of nightDates) {
      requiredUnits.push({ serviceDate: n, slotCode: 'NIGHT' });
    }
  } else {
    throw new Error(`Unsupported serviceType: ${serviceType}`);
  }

  // 4. Lead Time Check (BR-043: earliest date is tomorrow)
  if (startDate < earliestDate) {
    const err: any = new Error(
      `Appointments must be booked at least one day in advance. Earliest available date is ${earliestDate}.`
    );
    err.code = 'EARLIEST_DATE_VIOLATION';
    err.statusCode = 400;
    throw err;
  }

  // 5. Anti-Abuse Checks:
  // BR-042: Customer can have at most 2 bookings in PENDING_PAYMENT
  const activePendingCount = await prisma.booking.count({
    where: {
      customerId,
      status: 'PENDING_PAYMENT',
      holdExpiresAt: { gt: new Date() },
    },
  });

  if (activePendingCount >= 2) {
    const err: any = new Error(
      'You already have 2 active bookings awaiting payment. Please complete or allow them to expire before creating a new booking (BR-042).'
    );
    err.code = 'HOLD_LIMIT_REACHED';
    err.statusCode = 429;
    throw err;
  }

  // BR-041: No overlapping booking for the same pet
  const startDateUtc = new Date(`${startDate}T00:00:00.000Z`);
  const endDateUtc = new Date(`${endDate}T00:00:00.000Z`);

  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      petId,
      OR: [
        { status: 'CONFIRMED' },
        {
          status: 'PENDING_PAYMENT',
          holdExpiresAt: { gt: new Date() },
        },
      ],
      startDate: { lte: endDateUtc },
      endDate: { gte: startDateUtc },
    },
  });

  if (overlappingBooking) {
    const err: any = new Error(
      'This pet already has an active or confirmed booking during these dates (BR-041).'
    );
    err.code = 'OVERLAPPING_BOOKING';
    err.statusCode = 409;
    throw err;
  }

  // 6. Recalculate Trusted Server Price
  const petWeight = pet.weightKg !== null ? Number(pet.weightKg) : null;
  const dogSizeTier = pet.species === 'DOG' ? calculateDogSizeTier(petWeight) : null;

  const priceResult = calculatePrice({
    serviceType,
    species: pet.species,
    weightKg: petWeight,
    groomingPackage,
    quantity,
    includeTax: false, // In database, totalKobo = unitPriceKobo * quantity per booking_total_matches check constraint
  });

  const unitPriceKobo = priceResult.unitPriceKobo;
  const totalKobo = priceResult.unitPriceKobo * quantity; // strictly satisfies booking_total_matches constraint

  // 7. Atomic Database Transaction: Capacity Reservation & Booking Creation
  const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);

  // Fetch default capacity from config
  const config = await prisma.serviceConfig.findUnique({
    where: { serviceType },
  });
  const defaultCapacity =
    config?.defaultCapacity ?? (serviceType === 'GROOMING' ? 2 : serviceType === 'DAYCARE' ? 20 : 16);

  // Execute atomic transaction
  const createdBooking = await prisma.$transaction(
    async (tx) => {
      // 7a. Re-check closures inside transaction
      const closures = await tx.closure.findMany({
        where: {
          AND: [
            {
              OR: [
                { serviceType: null },
                { serviceType },
              ],
            },
            { startDate: { lte: endDateUtc } },
            { endDate: { gte: startDateUtc } },
          ],
        },
      });

      if (closures.length > 0) {
        const err: any = new Error(`Facility is closed during requested dates: ${closures[0].message || 'Closed'}`);
        err.code = 'FACILITY_CLOSED';
        err.statusCode = 409;
        throw err;
      }

      // 7b. In date order, reserve each required capacity unit
      const reservedCapacityUnitIds: string[] = [];

      for (const reqUnit of requiredUnits) {
        const unitDateUtc = new Date(`${reqUnit.serviceDate}T00:00:00.000Z`);

        // Ensure CapacityUnit record exists with an atomic upsert
        const capUnit = await tx.capacityUnit.upsert({
          where: {
            serviceType_serviceDate_slotCode: {
              serviceType,
              serviceDate: unitDateUtc,
              slotCode: reqUnit.slotCode,
            },
          },
          create: {
            serviceType,
            serviceDate: unitDateUtc,
            slotCode: reqUnit.slotCode,
            capacity: defaultCapacity,
            reserved: 0,
          },
          update: {},
        });

        // Check and release any expired unreleased booking units for this capacity unit
        const expiredUnits = await tx.bookingUnit.findMany({
          where: {
            capacityUnitId: capUnit.id,
            releasedAt: null,
            booking: {
              status: 'PENDING_PAYMENT',
              holdExpiresAt: { lt: new Date() },
            },
          },
          select: { id: true },
        });

        if (expiredUnits.length > 0) {
          const expIds = expiredUnits.map((u) => u.id);
          await tx.bookingUnit.updateMany({
            where: { id: { in: expIds } },
            data: { releasedAt: new Date() },
          });
          await tx.$executeRaw`
            UPDATE "CapacityUnit"
            SET "reserved" = GREATEST(0, "reserved" - ${expIds.length})
            WHERE "id" = ${capUnit.id}
          `;
        }

        // Atomically increment reserved only if reserved + 1 <= capacity (PostgreSQL row lock)
        const updateResult: number = await tx.$executeRaw`
          UPDATE "CapacityUnit"
          SET "reserved" = "reserved" + 1
          WHERE "id" = ${capUnit.id} AND ("reserved" + 1) <= "capacity"
        `;

        if (updateResult === 0) {
          const err: any = new Error(
            `Capacity full for ${serviceType} on ${reqUnit.serviceDate} (${reqUnit.slotCode}). Unable to reserve place.`
          );
          err.code = 'CAPACITY_EXCEEDED';
          err.statusCode = 409;
          throw err;
        }

        reservedCapacityUnitIds.push(capUnit.id);
      }

      // 7c. Generate Unique Booking Reference (BR-038)
      let reference = generateBookingReference();
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        const existingRef = await tx.booking.findUnique({ where: { reference } });
        if (!existingRef) {
          isUnique = true;
        } else {
          reference = generateBookingReference();
          attempts++;
        }
      }

      if (!isUnique) {
        throw new Error('Failed to generate unique booking reference');
      }

      // 7d. Create Booking Record (FR-013)
      const booking = await tx.booking.create({
        data: {
          reference,
          idempotencyKey,
          customerId,
          petId: pet.id,
          serviceType,
          groomingPackage: serviceType === 'GROOMING' ? groomingPackage : null,
          slotCode: serviceType === 'GROOMING' ? groomingSlot : null,
          status: 'PENDING_PAYMENT',
          startDate: startDateUtc,
          endDate: endDateUtc,
          quantity,
          petNameSnapshot: pet.name,
          petSpeciesSnapshot: pet.species,
          petWeightKgSnapshot: pet.weightKg,
          sizeTierSnapshot: dogSizeTier,
          unitPriceKobo,
          totalKobo, // Satisfies database constraint: totalKobo = unitPriceKobo * quantity
          currency: 'NGN',
          holdExpiresAt,
        },
      });

      // 7e. Create BookingUnit records linking booking to each reserved capacity unit
      await tx.bookingUnit.createMany({
        data: reservedCapacityUnitIds.map((capUnitId) => ({
          bookingId: booking.id,
          capacityUnitId: capUnitId,
        })),
      });

      return booking;
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );

  return { booking: createdBooking, isExisting: false };
}
