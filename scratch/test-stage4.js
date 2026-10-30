// Good Pets - Stage 4 Automated Verification Suite
// Tests Booking Creation, Atomic Capacity Holds, Reference Generation, Idempotency, and Concurrency

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

async function runStage4Tests() {
  console.log('--- Starting Stage 4 Automated Verification ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Reference Generator & Alphabet Unit Tests
  const { generateBookingReference, REFERENCE_ALPHABET, HOLD_DURATION_MINUTES } = require('../src/lib/capacity');

  test('BR-038: Booking reference format is GP- followed by 6 valid characters', () => {
    const ref = generateBookingReference();
    assert.match(ref, /^GP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    assert.strictEqual(ref.length, 9);
    // Disallowed characters check: 0, 1, I, O
    assert.ok(!ref.includes('0'), 'Must not contain 0');
    assert.ok(!ref.includes('1'), 'Must not contain 1');
    assert.ok(!ref.includes('I'), 'Must not contain I');
    assert.ok(!ref.includes('O'), 'Must not contain O');
  });

  test('BR-017: Hold duration is configured to 10 minutes', () => {
    assert.strictEqual(HOLD_DURATION_MINUTES, 10);
  });

  // Setup test users & pets
  const timestamp = Date.now();
  const userAEmail = `stage4_userA_${timestamp}@example.com`;
  const userBEmail = `stage4_userB_${timestamp}@example.com`;
  let userACookie = '';
  let userBCookie = '';
  let userAId = '';
  let userBId = '';
  let petADogId = '';
  let petBCatId = '';

  function getFutureDate(daysAhead) {
    const d = new Date(Date.now() + daysAhead * 86400000);
    return d.toISOString().split('T')[0];
  }

  const runOffset = Math.floor(Math.random() * 200) + 30; // 30-230 days ahead
  const groomingDate = getFutureDate(runOffset);
  const groomingSlot = '09:00';
  const daycareStart = getFutureDate(runOffset + 10);
  const daycareEnd = getFutureDate(runOffset + 12); // 3 days
  const daycareDays = [
    getFutureDate(runOffset + 10),
    getFutureDate(runOffset + 11),
    getFutureDate(runOffset + 12),
  ];
  const boardingIn = getFutureDate(runOffset + 20);
  const boardingOut = getFutureDate(runOffset + 27); // 7 nights
  const boardingNights = [
    getFutureDate(runOffset + 20),
    getFutureDate(runOffset + 21),
    getFutureDate(runOffset + 22),
    getFutureDate(runOffset + 23),
    getFutureDate(runOffset + 24),
    getFutureDate(runOffset + 25),
    getFutureDate(runOffset + 26),
  ];
  const boardingOutDate = getFutureDate(runOffset + 27);

  await testAsync('Auth: Create User A and obtain session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Customer',
        email: userAEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    userAId = data.user.id;
    userACookie = res.headers.get('set-cookie').split(';')[0];
  });

  await testAsync('Auth: Create User B and obtain session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Customer',
        email: userBEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    userBId = data.user.id;
    userBCookie = res.headers.get('set-cookie').split(';')[0];
  });

  await testAsync('Pets: Add Dog to User A (Rex, 20.0 kg Medium)', async () => {
    const res = await fetch(`${BASE_URL}/api/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        name: 'Rex',
        species: 'DOG',
        breed: 'Labrador',
        weightKg: 20.0,
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    petADogId = data.pet.id;
  });

  await testAsync('Pets: Add Cat to User B (Cleo)', async () => {
    const res = await fetch(`${BASE_URL}/api/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userBCookie },
      body: JSON.stringify({
        name: 'Cleo',
        species: 'CAT',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    petBCatId = data.pet.id;
  });

  // 2. Security & Validation on Creation
  await testAsync('Security: Unauthenticated booking creation rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `idem_anon_${Date.now()}`,
        petId: petADogId,
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate: '2026-11-20',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 401);
  });

  await testAsync('Security: User A cannot create booking with User B pet (404 Data Isolation)', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        idempotencyKey: `idem_isolation_${Date.now()}`,
        petId: petBCatId, // Belongs to User B
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate: '2026-11-20',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  await testAsync('Validation: Missing idempotency key rejected with 400', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        petId: petADogId,
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate: '2026-11-20',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  // 3. Grooming Booking Creation & Atomic Capacity Hold
  let groomingRef = '';
  const groomingIdemKey = `idem_groom_${timestamp}`;

  await testAsync('Booking Creation: Successful Grooming booking with capacity hold', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        idempotencyKey: groomingIdemKey,
        petId: petADogId,
        serviceType: 'GROOMING',
        groomingPackage: 'FULL',
        groomingDate,
        groomingSlot,
      }),
    });
    const data = await res.json();
    if (res.status !== 201) {
      console.log('Grooming booking failed response:', res.status, data);
    }
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.isExisting, false);
    assert.match(data.booking.reference, /^GP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    assert.strictEqual(data.booking.status, 'PENDING_PAYMENT');
    assert.strictEqual(data.booking.serviceType, 'GROOMING');
    assert.strictEqual(data.booking.groomingPackage, 'FULL');
    assert.strictEqual(data.booking.slotCode, groomingSlot);
    assert.strictEqual(data.booking.petNameSnapshot, 'Rex');
    assert.strictEqual(data.booking.sizeTierSnapshot, 'MEDIUM');
    // Medium dog Full Groom: ₦27,000 (2,700,000 kobo)
    assert.strictEqual(data.booking.unitPriceKobo, 2700000);
    assert.strictEqual(data.booking.totalKobo, 2700000);
    assert.strictEqual(data.booking.formattedTotal, '₦27,000');
    assert.ok(data.booking.holdExpiresAt);
    groomingRef = data.booking.reference;

    // Verify database state: CapacityUnit reserved counter incremented to 1
    const cu = await prisma.capacityUnit.findUnique({
      where: {
        serviceType_serviceDate_slotCode: {
          serviceType: 'GROOMING',
          serviceDate: new Date(`${groomingDate}T00:00:00.000Z`),
          slotCode: groomingSlot,
        },
      },
    });
    assert.ok(cu);
    assert.strictEqual(cu.reserved, 1);
    assert.strictEqual(cu.capacity, 2);

    // Verify BookingUnit link created
    const bu = await prisma.bookingUnit.findFirst({
      where: { bookingId: data.booking.id, capacityUnitId: cu.id },
    });
    assert.ok(bu, 'BookingUnit must link booking to capacityUnit');
    assert.strictEqual(bu.releasedAt, null);
  });

  // 4. Idempotency Verification
  await testAsync('Idempotency: Re-submitting with identical key returns existing booking without duplicate', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        idempotencyKey: groomingIdemKey,
        petId: petADogId,
        serviceType: 'GROOMING',
        groomingPackage: 'FULL',
        groomingDate,
        groomingSlot,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.isExisting, true);
    assert.strictEqual(data.booking.reference, groomingRef);

    // Verify capacity was NOT incremented again
    const cu = await prisma.capacityUnit.findUnique({
      where: {
        serviceType_serviceDate_slotCode: {
          serviceType: 'GROOMING',
          serviceDate: new Date(`${groomingDate}T00:00:00.000Z`),
          slotCode: groomingSlot,
        },
      },
    });
    assert.strictEqual(cu.reserved, 1, 'Reserved must still be 1 after idempotent retry');
  });

  await testAsync('Idempotency: Re-using idempotency key with different service rejected with 409', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        idempotencyKey: groomingIdemKey,
        petId: petADogId,
        serviceType: 'DAYCARE', // Different service
        daycareStartDate: '2026-11-26',
        daycareEndDate: '2026-11-26',
      }),
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.code, 'IDEMPOTENCY_CONFLICT');
  });

  // 5. Daycare Multi-Day Booking & Complete Reservation
  const daycareIdemKey = `idem_daycare_${timestamp}`;

  await testAsync('Booking Creation: Successful 3-day Daycare booking reserves each day', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        idempotencyKey: daycareIdemKey,
        petId: petADogId,
        serviceType: 'DAYCARE',
        daycareMode: 'range',
        daycareStartDate: daycareStart,
        daycareEndDate: daycareEnd,
      }),
    });
    const data = await res.json();
    if (res.status !== 201) {
      console.log('Daycare booking failed response:', res.status, data);
    }
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.booking.quantity, 3);
    assert.strictEqual(data.booking.unitPriceKobo, 1200000);
    assert.strictEqual(data.booking.totalKobo, 3600000); // ₦36,000

    // Check each day's capacity unit reserved counter
    for (const d of daycareDays) {
      const cu = await prisma.capacityUnit.findUnique({
        where: {
          serviceType_serviceDate_slotCode: {
            serviceType: 'DAYCARE',
            serviceDate: new Date(`${d}T00:00:00.000Z`),
            slotCode: 'DAY',
          },
        },
      });
      assert.ok(cu, `Capacity unit must exist for ${d}`);
      assert.strictEqual(cu.reserved, 1);
      assert.strictEqual(cu.capacity, 20);
    }
  });

  // 6. Anti-Abuse Limit (BR-042: Max 2 PENDING_PAYMENT holds per customer)
  await testAsync('Anti-Abuse: Third PENDING_PAYMENT booking by User A rejected (BR-042, 429)', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({
        idempotencyKey: `idem_third_${timestamp}`,
        petId: petADogId,
        serviceType: 'BOARDING',
        boardingCheckIn: boardingIn,
        boardingCheckOut: getFutureDate(runOffset + 22),
      }),
    });
    assert.strictEqual(res.status, 429);
    const data = await res.json();
    assert.strictEqual(data.code, 'HOLD_LIMIT_REACHED');
  });

  // 7. Boarding Multi-Night Booking by User B
  const boardingIdemKey = `idem_boarding_${timestamp}`;

  await testAsync('Booking Creation: Successful 7-night Boarding booking reserves 7 nights (BR-010)', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userBCookie },
      body: JSON.stringify({
        idempotencyKey: boardingIdemKey,
        petId: petBCatId,
        serviceType: 'BOARDING',
        boardingCheckIn: boardingIn,
        boardingCheckOut: boardingOut,
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.booking.quantity, 7);
    assert.strictEqual(data.booking.unitPriceKobo, 2500000);
    assert.strictEqual(data.booking.totalKobo, 17500000); // ₦175,000

    // Check that boarding nights have reserved = 1, but check-out day does NOT use a kennel (BR-010)
    for (const n of boardingNights) {
      const cu = await prisma.capacityUnit.findUnique({
        where: {
          serviceType_serviceDate_slotCode: {
            serviceType: 'BOARDING',
            serviceDate: new Date(`${n}T00:00:00.000Z`),
            slotCode: 'NIGHT',
          },
        },
      });
      assert.ok(cu, `Kennel capacity unit must exist for night ${n}`);
      assert.strictEqual(cu.reserved, 1);
      assert.strictEqual(cu.capacity, 16);
    }

    const checkOutDayCu = await prisma.capacityUnit.findUnique({
      where: {
        serviceType_serviceDate_slotCode: {
          serviceType: 'BOARDING',
          serviceDate: new Date(`${boardingOutDate}T00:00:00.000Z`),
          slotCode: 'NIGHT',
        },
      },
    });
    assert.strictEqual(checkOutDayCu, null, 'Check-out date itself does not use a kennel space (BR-010)');
  });

  // 8. Atomic Concurrency & Capacity Exceeded Rollback Test
  await testAsync('Concurrency & Capacity Limit: Slot full (2/2) rejects 3rd booking and rolls back cleanly', async () => {
    // Fill the remaining place on Grooming (2026-11-25 09:00): currently reserved=1 of 2
    // User B books the 2nd place
    const res2 = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userBCookie },
      body: JSON.stringify({
        idempotencyKey: `idem_groom_fill_${timestamp}`,
        petId: petBCatId,
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate,
        groomingSlot,
      }),
    });
    assert.strictEqual(res2.status, 201);

    // Verify slot is now full (2/2)
    const cuFull = await prisma.capacityUnit.findUnique({
      where: {
        serviceType_serviceDate_slotCode: {
          serviceType: 'GROOMING',
          serviceDate: new Date(`${groomingDate}T00:00:00.000Z`),
          slotCode: groomingSlot,
        },
      },
    });
    assert.strictEqual(cuFull.reserved, 2);

    // Create User C to attempt 3rd booking on full slot
    const userCEmail = `stage4_userC_${Date.now()}@example.com`;
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User C', email: userCEmail, password: 'Password123!', confirmPassword: 'Password123!' }),
    });
    const userCCookie = signupRes.headers.get('set-cookie').split(';')[0];
    const petRes = await fetch(`${BASE_URL}/api/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCCookie },
      body: JSON.stringify({ name: 'Pepper', species: 'CAT' }),
    });
    const petC = (await petRes.json()).pet;

    // Record bookings count before failed attempt
    const bookingsBefore = await prisma.booking.count();

    // Attempt 3rd booking on 2-capacity slot
    const res3 = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCCookie },
      body: JSON.stringify({
        idempotencyKey: `idem_groom_overflow_${timestamp}`,
        petId: petC.id,
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate,
        groomingSlot,
      }),
    });
    assert.strictEqual(res3.status, 409);
    const data3 = await res3.json();
    assert.strictEqual(data3.code, 'CAPACITY_EXCEEDED');

    // Confirm total bookings remained unchanged and capacity unit did not exceed 2
    const bookingsAfter = await prisma.booking.count();
    assert.strictEqual(bookingsBefore, bookingsAfter, 'Failed transaction must create ZERO bookings');

    const cuAfter = await prisma.capacityUnit.findUnique({
      where: {
        serviceType_serviceDate_slotCode: {
          serviceType: 'GROOMING',
          serviceDate: new Date(`${groomingDate}T00:00:00.000Z`),
          slotCode: groomingSlot,
        },
      },
    });
    assert.strictEqual(cuAfter.reserved, 2, 'Reserved places must never exceed capacity (BR-011)');
  });

  // 9. Hold Expiration and Safe Release
  await testAsync('Hold Management: Expired hold is safely released and capacity reclaimed', async () => {
    const { releaseExpiredHolds } = require('../src/lib/capacity');

    // Create an artificial expired booking in PENDING_PAYMENT with holdExpiresAt in the past
    const expiredSlot = '12:00';
    const testDateUtc = new Date(`${getFutureDate(runOffset + 40)}T00:00:00.000Z`);

    let capUnit = await prisma.capacityUnit.findUnique({
      where: {
        serviceType_serviceDate_slotCode: {
          serviceType: 'GROOMING',
          serviceDate: testDateUtc,
          slotCode: expiredSlot,
        },
      },
    });
    if (!capUnit) {
      capUnit = await prisma.capacityUnit.create({
        data: {
          serviceType: 'GROOMING',
          serviceDate: testDateUtc,
          slotCode: expiredSlot,
          capacity: 2,
          reserved: 1,
        },
      });
    } else {
      await prisma.capacityUnit.update({
        where: { id: capUnit.id },
        data: { reserved: capUnit.reserved + 1 },
      });
    }

    const expiredBooking = await prisma.booking.create({
      data: {
        reference: generateBookingReference(),
        idempotencyKey: `idem_expired_${Date.now()}`,
        customerId: userAId,
        petId: petADogId,
        serviceType: 'GROOMING',
        status: 'PENDING_PAYMENT',
        startDate: testDateUtc,
        endDate: testDateUtc,
        quantity: 1,
        petNameSnapshot: 'Rex',
        petSpeciesSnapshot: 'DOG',
        unitPriceKobo: 1200000,
        totalKobo: 1200000,
        holdExpiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      },
    });

    const expiredBu = await prisma.bookingUnit.create({
      data: {
        bookingId: expiredBooking.id,
        capacityUnitId: capUnit.id,
      },
    });

    const reservedBeforeRelease = (await prisma.capacityUnit.findUnique({ where: { id: capUnit.id } })).reserved;

    // Run release
    const released = await releaseExpiredHolds();
    assert.ok(released >= 1, 'Should release at least 1 expired unit');

    const reservedAfterRelease = (await prisma.capacityUnit.findUnique({ where: { id: capUnit.id } })).reserved;
    assert.strictEqual(reservedAfterRelease, reservedBeforeRelease - 1, 'Reserved capacity must decrement by 1');

    // Confirm booking status updated to EXPIRED
    const updatedBk = await prisma.booking.findUnique({ where: { id: expiredBooking.id } });
    assert.strictEqual(updatedBk.status, 'EXPIRED');

    // Idempotent retry of release does not corrupt counters
    const secondRelease = await releaseExpiredHolds();
    assert.strictEqual(secondRelease, 0, 'Re-running release should find 0 units to release');
    const reservedAfterSecond = (await prisma.capacityUnit.findUnique({ where: { id: capUnit.id } })).reserved;
    assert.strictEqual(reservedAfterSecond, reservedAfterRelease);
  });

  console.log(`\n--- Stage 4 Verification Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runStage4Tests()
  .catch((err) => {
    console.error('Stage 4 test run failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
