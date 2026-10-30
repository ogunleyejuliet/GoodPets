// Good Pets - Stage 3 Automated Verification Suite
// Tests Booking Review endpoint, server-side validation, 2% tax, policies, and data isolation

const assert = require('assert');

async function runStage3Tests() {
  console.log('--- Starting Stage 3 Automated Verification ---');
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

  const { calculatePrice, formatNaira } = require('../src/lib/pricing');

  // 1. Pricing and 2% Tax Unit Tests
  test('Stage 3 Pricing: Dog Grooming Medium Full Groom (₦27,000) + 2% tax (₦540) = ₦27,540', () => {
    const res = calculatePrice({
      serviceType: 'GROOMING',
      species: 'DOG',
      weightKg: 15.0,
      groomingPackage: 'FULL',
      includeTax: true,
    });
    assert.strictEqual(res.unitPriceKobo, 2700000);
    assert.strictEqual(res.subtotalKobo, 2700000);
    assert.strictEqual(res.taxKobo, 54000);
    assert.strictEqual(res.taxRatePercent, 2);
    assert.strictEqual(res.totalKobo, 2754000);
    assert.strictEqual(res.formattedSubtotal, '₦27,000');
    assert.strictEqual(res.formattedTax, '₦540');
    assert.strictEqual(res.formattedTotal, '₦27,540');
  });

  test('Stage 3 Pricing: 3-day Daycare (₦36,000) + 2% tax (₦720) = ₦36,720', () => {
    const res = calculatePrice({
      serviceType: 'DAYCARE',
      species: 'DOG',
      quantity: 3,
      includeTax: true,
    });
    assert.strictEqual(res.unitPriceKobo, 1200000);
    assert.strictEqual(res.quantity, 3);
    assert.strictEqual(res.subtotalKobo, 3600000);
    assert.strictEqual(res.taxKobo, 72000);
    assert.strictEqual(res.taxRatePercent, 2);
    assert.strictEqual(res.totalKobo, 3672000);
    assert.strictEqual(res.formattedSubtotal, '₦36,000');
    assert.strictEqual(res.formattedTax, '₦720');
    assert.strictEqual(res.formattedTotal, '₦36,720');
  });

  test('Stage 3 Pricing: 7-night Boarding (₦175,000) + 2% tax (₦3,500) = ₦178,500', () => {
    const res = calculatePrice({
      serviceType: 'BOARDING',
      species: 'DOG',
      quantity: 7,
      includeTax: true,
    });
    assert.strictEqual(res.unitPriceKobo, 2500000);
    assert.strictEqual(res.quantity, 7);
    assert.strictEqual(res.subtotalKobo, 17500000);
    assert.strictEqual(res.taxKobo, 350000);
    assert.strictEqual(res.taxRatePercent, 2);
    assert.strictEqual(res.totalKobo, 17850000);
    assert.strictEqual(res.formattedSubtotal, '₦175,000');
    assert.strictEqual(res.formattedTax, '₦3,500');
    assert.strictEqual(res.formattedTotal, '₦178,500');
  });

  test('Stage 3 Pricing: Integer kobo calculations avoid floating point rounding errors', () => {
    // ₦13,333.33 -> 1,333,333 kobo * 2 / 100 = 26,666.66 -> Math.round -> 26,667 kobo
    const subtotalKobo = 1333333;
    const taxKobo = Math.round((subtotalKobo * 2) / 100);
    assert.strictEqual(taxKobo, 26667);
    assert.strictEqual(subtotalKobo + taxKobo, 1360000);
  });

  // 2. Integration Tests with Live Server
  const BASE_URL = 'http://localhost:3000';

  // Create two distinct test users to verify data isolation
  const user1Email = `stage3_user1_${Date.now()}@example.com`;
  const user2Email = `stage3_user2_${Date.now()}@example.com`;
  let user1Cookie = '';
  let user2Cookie = '';
  let user1PetId = '';
  let user2PetId = '';

  await testAsync('Auth: Create User 1 and obtain session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User One',
        email: user1Email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 201);
    const rawCookie = res.headers.get('set-cookie');
    assert.ok(rawCookie, 'User 1 session cookie received');
    user1Cookie = rawCookie.split(';')[0];
  });

  await testAsync('Auth: Create User 2 and obtain session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User Two',
        email: user2Email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 201);
    const rawCookie = res.headers.get('set-cookie');
    assert.ok(rawCookie, 'User 2 session cookie received');
    user2Cookie = rawCookie.split(';')[0];
  });

  await testAsync('Pets: Add Dog to User 1 (Milo, 14.5 kg)', async () => {
    const res = await fetch(`${BASE_URL}/api/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        name: 'Milo',
        species: 'DOG',
        breed: 'Golden Retriever',
        weightKg: 14.5,
        careNotes: 'Friendly and gentle',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.pet.id);
    user1PetId = data.pet.id;
  });

  await testAsync('Pets: Add Cat to User 2 (Luna)', async () => {
    const res = await fetch(`${BASE_URL}/api/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user2Cookie,
      },
      body: JSON.stringify({
        name: 'Luna',
        species: 'CAT',
        breed: 'Persian',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.pet.id);
    user2PetId = data.pet.id;
  });

  // 3. Security & Validation Tests
  await testAsync('Security: Unauthenticated request to review endpoint returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        petId: user1PetId,
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate: '2026-11-15',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 401);
  });

  await testAsync('Security: User 1 cannot review booking for User 2 pet (404 Data Isolation)', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        petId: user2PetId, // User 2's pet
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate: '2026-11-15',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  await testAsync('Validation: Past or same-day dates rejected with 400 (BR-043)', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        petId: user1PetId,
        serviceType: 'GROOMING',
        groomingPackage: 'BASIC',
        groomingDate: '2020-01-01',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.code, 'EARLIEST_DATE_VIOLATION');
  });

  await testAsync('Validation: Cat cannot review Premium Grooming package (FR-009, 400)', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user2Cookie,
      },
      body: JSON.stringify({
        petId: user2PetId, // Cat
        serviceType: 'GROOMING',
        groomingPackage: 'PREMIUM', // Not allowed for cats
        groomingDate: '2026-11-15',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  await testAsync('Validation: Client-forged prices are completely ignored by the server', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        petId: user1PetId,
        serviceType: 'GROOMING',
        groomingPackage: 'FULL',
        groomingDate: '2026-11-15',
        groomingSlot: '09:00',
        unitPriceKobo: 100, // Forged client values
        subtotalKobo: 100,
        taxKobo: 0,
        totalKobo: 100,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Milo is a 14.5 kg dog -> Medium -> Full Groom is ₦27,000 subtotal, ₦540 tax, ₦27,540 total
    assert.strictEqual(data.review.pricing.subtotalKobo, 2700000);
    assert.strictEqual(data.review.pricing.taxKobo, 54000);
    assert.strictEqual(data.review.pricing.totalKobo, 2754000);
    assert.strictEqual(data.review.pricing.formattedTotal, '₦27,540');
  });

  // 4. Policy Information Verification
  await testAsync('Policy: Grooming reschedule policy is at least 2 days and includes vaccination notice', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        petId: user1PetId,
        serviceType: 'GROOMING',
        groomingPackage: 'FULL',
        groomingDate: '2026-11-15',
        groomingSlot: '09:00',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.review.policies.rescheduleDeadline.includes('2 days'));
    assert.ok(data.review.policies.cancellation.includes('No cancellations or refunds'));
    assert.ok(data.review.policies.vaccinationNotice.includes('DHPP'));
    assert.strictEqual(data.review.schedule.durationMinutes, 90);
  });

  await testAsync('Policy: Daycare reschedule policy is at least 1 day and includes ₦5,000 late penalty', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        petId: user1PetId,
        serviceType: 'DAYCARE',
        daycareMode: 'range',
        daycareStartDate: '2026-11-15',
        daycareEndDate: '2026-11-17', // 3 days
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.review.policies.rescheduleDeadline.includes('1 day'));
    assert.ok(data.review.policies.latePickupNotice.includes('₦5,000'));
    assert.strictEqual(data.review.schedule.totalDays, 3);
    assert.strictEqual(data.review.schedule.operatingHours, '8:00 AM – 8:00 PM');
    assert.strictEqual(data.review.pricing.subtotalKobo, 3600000);
    assert.strictEqual(data.review.pricing.taxKobo, 72000);
    assert.strictEqual(data.review.pricing.totalKobo, 3672000);
  });

  await testAsync('Policy: Boarding reschedule policy is at least 2 days and includes 8 PM – 8 AM stay window', async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: user1Cookie,
      },
      body: JSON.stringify({
        petId: user1PetId,
        serviceType: 'BOARDING',
        boardingCheckIn: '2026-12-20',
        boardingCheckOut: '2026-12-27', // 7 nights
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.review.policies.rescheduleDeadline.includes('2 days'));
    assert.strictEqual(data.review.schedule.totalNights, 7);
    assert.strictEqual(data.review.schedule.stayWindow, '8:00 PM – 8:00 AM');
    assert.ok(data.review.schedule.kennelRule.includes('check-out day does not use a kennel space'));
    assert.strictEqual(data.review.pricing.subtotalKobo, 17500000);
    assert.strictEqual(data.review.pricing.taxKobo, 350000);
    assert.strictEqual(data.review.pricing.totalKobo, 17850000);
  });

  // 5. Scope Boundary Verification: Ensure review does NOT create booking or hold capacity
  await testAsync('Scope Boundary: Review request creates ZERO booking records and ZERO capacity holds', async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const bookingsCountBefore = await prisma.booking.count();
      const capacityUnitsBefore = await prisma.capacityUnit.findMany({ select: { id: true, reserved: true } });

      // Run another review call
      const res = await fetch(`${BASE_URL}/api/bookings/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: user1Cookie,
        },
        body: JSON.stringify({
          petId: user1PetId,
          serviceType: 'GROOMING',
          groomingPackage: 'BASIC',
          groomingDate: '2026-11-20',
          groomingSlot: '12:00',
        }),
      });
      assert.strictEqual(res.status, 200);

      const bookingsCountAfter = await prisma.booking.count();
      const capacityUnitsAfter = await prisma.capacityUnit.findMany({ select: { id: true, reserved: true } });

      assert.strictEqual(bookingsCountBefore, bookingsCountAfter, 'Zero bookings must be created during review');
      assert.deepStrictEqual(capacityUnitsBefore, capacityUnitsAfter, 'Zero capacity units must be reserved during review');
    } finally {
      await prisma.$disconnect();
    }
  });

  console.log(`\n--- Stage 3 Verification Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runStage3Tests().catch((err) => {
  console.error('Stage 3 test run failed:', err);
  process.exit(1);
});

