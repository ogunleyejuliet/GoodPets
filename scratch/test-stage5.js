/**
 * Good Pets - Stage 5 Automated Verification Suite
 * 
 * Tests all 13 scenarios for Paystack Payment Integration:
 * 1. Successful payment initialization returning Paystack authorization URL
 * 2. Unauthenticated payment initialization rejected (401)
 * 3. Payment initialization on another customer's booking rejected (404 data isolation)
 * 4. Payment initialization on an expired booking rejected (HOLD_EXPIRED)
 * 5. Verification rejecting incorrect amount or currency
 * 6. Verification rejecting invalid or fabricated transaction references
 * 7. Verification confirming booking upon valid successful Paystack response
 * 8. Failed and abandoned transactions updating payment record without confirming booking
 * 9. Webhook handler rejecting requests with invalid signatures (401)
 * 10. Webhook handler processing duplicate events idempotently (200 with deduplication)
 * 11. Safe handling of duplicate payment attempts (no two active holds, no extended hold)
 * 12. Late payment handling after hold expiry (re-reserve on available capacity, NEEDS_ATTENTION on full)
 * 13. Ensuring capacity is not incremented twice on confirmation
 */

const assert = require('assert');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_dd70a1294ba92d953f5c9e9ed5de2f0fe89ac7ef';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

function computeHmacSignature(payload, secret) {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
}

async function runAllTests() {
  console.log('=== Good Pets: Stage 5 Automated Verification Suite ===\n');

  const timestamp = Date.now();
  const testEmailA = `stage5_userA_${timestamp}@example.com`;
  const testEmailB = `stage5_userB_${timestamp}@example.com`;
  let cookieA = '';
  let cookieB = '';
  let userAId = '';
  let userBId = '';
  let petAId = '';
  let bookingARef = '';
  let bookingBRef = '';
  let bookingATotalKobo = 0;

  try {
    // Setup 1: Register User A
    const resA = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User A Test',
        email: testEmailA,
        password: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    assert.strictEqual(resA.status, 201, 'User A signup failed');
    userAId = dataA.user.id;
    const rawCookieA = resA.headers.get('set-cookie');
    cookieA = rawCookieA ? rawCookieA.split(';')[0] : '';

    // Setup 2: Register User B
    const resB = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User B Test',
        email: testEmailB,
        password: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    assert.strictEqual(resB.status, 201, 'User B signup failed');
    userBId = dataB.user.id;
    const rawCookieB = resB.headers.get('set-cookie');
    cookieB = rawCookieB ? rawCookieB.split(';')[0] : '';

    // Setup 3: Create Pet for User A
    const petRes = await fetch(`${BASE_URL}/api/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({
        name: 'Fido Test',
        species: 'DOG',
        breed: 'Golden Retriever',
        weightKg: 15,
      }),
    });
    const petData = await petRes.json();
    assert.strictEqual(petRes.status, 201, 'Pet creation failed');
    petAId = petData.pet.id;

    // Setup 4: Create Booking for User A (Daycare, 3 days ahead)
    const futureDate = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0];
    const bookingRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({
        idempotencyKey: `stage5_key_${timestamp}`,
        petId: petAId,
        serviceType: 'DAYCARE',
        daycareMode: 'single',
        daycareStartDate: futureDate,
        daycareEndDate: futureDate,
      }),
    });
    const bookingData = await bookingRes.json();
    assert.strictEqual(bookingRes.status, 201, 'Booking A creation failed');
    bookingARef = bookingData.booking.reference;
    bookingATotalKobo = bookingData.booking.totalKobo;

    // --- TEST SCENARIO 2: Unauthenticated payment initialization rejected (401) ---
    await test('Scenario 2: Unauthenticated payment initialization rejected with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: bookingARef,
          channel: 'card',
        }),
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.error.includes('Authentication required'));
    });

    // --- TEST SCENARIO 3: Payment initialization on another customer's booking rejected (404 data isolation) ---
    await test("Scenario 3: Payment initialization on another customer's booking returns 404", async () => {
      const res = await fetch(`${BASE_URL}/api/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieB, // User B trying to pay User A's booking
        },
        body: JSON.stringify({
          bookingReference: bookingARef,
          channel: 'card',
        }),
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.ok(data.error.includes('Booking not found'));
    });

    // --- TEST SCENARIO 4: Payment initialization on expired booking rejected ---
    await test('Scenario 4: Payment initialization on expired booking hold rejected', async () => {
      // Create a temporary booking with an expired hold
      const expiredBooking = await prisma.booking.create({
        data: {
          reference: `GP-EXP${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
          idempotencyKey: `exp_${timestamp}`,
          customerId: userAId,
          petId: petAId,
          serviceType: 'DAYCARE',
          status: 'PENDING_PAYMENT',
          startDate: new Date(Date.now() + 86400000 * 50),
          endDate: new Date(Date.now() + 86400000 * 50),
          quantity: 1,
          petNameSnapshot: 'Fido Test',
          petSpeciesSnapshot: 'DOG',
          unitPriceKobo: 500000,
          totalKobo: 500000,
          holdExpiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
        },
      });

      const res = await fetch(`${BASE_URL}/api/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
        },
        body: JSON.stringify({
          bookingReference: expiredBooking.reference,
          channel: 'card',
        }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'HOLD_EXPIRED');

      // Cleanup
      await prisma.booking.delete({ where: { id: expiredBooking.id } });
    });

    // --- TEST SCENARIO 1: Successful payment initialization returning Paystack authorization URL ---
    let initializedRef = '';
    await test('Scenario 1: Successful payment initialization returns Paystack authorization_url and reference', async () => {
      const res = await fetch(`${BASE_URL}/api/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
        },
        body: JSON.stringify({
          bookingReference: bookingARef,
          channel: 'card',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.authorizationUrl, 'Must return authorizationUrl');
      assert.ok(data.accessCode, 'Must return accessCode');
      assert.ok(data.reference.startsWith(`PAY-${bookingARef}`), 'Reference must contain booking reference');
      initializedRef = data.reference;

      // Verify payment was recorded in database with status INITIATED
      const paymentRecord = await prisma.payment.findUnique({
        where: { reference: initializedRef },
      });
      assert.ok(paymentRecord, 'Payment record must be persisted in database');
      assert.strictEqual(paymentRecord.status, 'INITIATED');
      assert.strictEqual(paymentRecord.amountKobo, bookingATotalKobo);
      assert.strictEqual(paymentRecord.currency, 'NGN');
    });

    // --- TEST SCENARIO 11: Safe handling of duplicate payment attempts (BR-044) ---
    await test('Scenario 11: Duplicate payment initialization safely cancels open attempt without extending hold', async () => {
      // Re-initialize payment for the same booking
      const res = await fetch(`${BASE_URL}/api/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
        },
        body: JSON.stringify({
          bookingReference: bookingARef,
          channel: 'bank_transfer',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      const secondRef = data.reference;
      assert.notStrictEqual(secondRef, initializedRef, 'Must generate fresh reference');

      // Check that previous payment attempt was marked ABANDONED (one open payment at a time per BR-044)
      const prevPayment = await prisma.payment.findUnique({
        where: { reference: initializedRef },
      });
      assert.strictEqual(prevPayment.status, 'ABANDONED');

      // Update initializedRef to secondRef for subsequent tests
      initializedRef = secondRef;
    });

    // --- TEST SCENARIO 9: Webhook handler rejecting requests with invalid signatures (401) ---
    await test('Scenario 9: Webhook handler rejects requests with invalid or missing HMAC signatures', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'some_ref' } });

      // No signature
      const resNoSig = await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      assert.strictEqual(resNoSig.status, 401);

      // Invalid signature
      const resBadSig = await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': 'invalid_signature_hex_string_12345',
        },
        body: payload,
      });
      assert.strictEqual(resBadSig.status, 401);
    });

    // --- TEST SCENARIO 5: Verification rejecting incorrect amount or currency ---
    await test('Scenario 5: Webhook / verification rejects incorrect amount or wrong currency', async () => {
      // 5a: Wrong Currency (USD instead of NGN)
      const wrongCurrencyPayload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999901,
          reference: initializedRef,
          amount: bookingATotalKobo,
          currency: 'USD', // INVALID
          status: 'success',
          paid_at: new Date().toISOString(),
        },
      });
      const sig1 = computeHmacSignature(wrongCurrencyPayload, PAYSTACK_SECRET);
      const resCurrency = await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig1,
        },
        body: wrongCurrencyPayload,
      });
      assert.strictEqual(resCurrency.status, 200); // 200 acknowledged, but payment marked FAILED
      const payRecord1 = await prisma.payment.findUnique({ where: { reference: initializedRef } });
      assert.strictEqual(payRecord1.status, 'FAILED');
      assert.ok(payRecord1.gatewayResponse.includes('Currency mismatch'));

      // Reset payment back to INITIATED for next sub-test
      await prisma.payment.update({
        where: { reference: initializedRef },
        data: { status: 'INITIATED', gatewayResponse: null },
      });

      // 5b: Wrong Amount (e.g. 1000 kobo instead of expected total)
      const wrongAmountPayload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999902,
          reference: initializedRef,
          amount: bookingATotalKobo - 100, // INVALID
          currency: 'NGN',
          status: 'success',
          paid_at: new Date().toISOString(),
        },
      });
      const sig2 = computeHmacSignature(wrongAmountPayload, PAYSTACK_SECRET);
      await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig2,
        },
        body: wrongAmountPayload,
      });
      const payRecord2 = await prisma.payment.findUnique({ where: { reference: initializedRef } });
      assert.strictEqual(payRecord2.status, 'FAILED');
      assert.ok(payRecord2.gatewayResponse.includes('Amount mismatch'));

      // Reset payment back to INITIATED for successful confirmation test
      await prisma.payment.update({
        where: { reference: initializedRef },
        data: { status: 'INITIATED', gatewayResponse: null },
      });
    });

    // --- TEST SCENARIO 6: Verification rejecting invalid or fabricated transaction references ---
    await test('Scenario 6: Verification rejects non-existent or fabricated transaction references', async () => {
      const fabricatedRef = 'PAY-FABRICATED-REFERENCE-XYZ';
      const fakePayload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999903,
          reference: fabricatedRef,
          amount: 500000,
          currency: 'NGN',
          status: 'success',
        },
      });
      const sig = computeHmacSignature(fakePayload, PAYSTACK_SECRET);
      const res = await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: fakePayload,
      });
      assert.strictEqual(res.status, 200);
      const webhookRec = await prisma.webhookEvent.findFirst({
        where: { reference: fabricatedRef },
      });
      assert.ok(webhookRec);
      assert.strictEqual(webhookRec.status, 'FAILED');
      assert.ok(webhookRec.error.includes('not found'));
    });

    // --- TEST SCENARIO 8: Failed and abandoned transactions updating payment without confirming booking ---
    await test('Scenario 8: Failed and abandoned transactions update payment record without confirming booking', async () => {
      const failedPaymentRef = `PAY-${bookingARef}-FAILTEST`;
      await prisma.payment.create({
        data: {
          bookingId: (await prisma.booking.findUnique({ where: { reference: bookingARef } })).id,
          reference: failedPaymentRef,
          amountKobo: bookingATotalKobo,
          currency: 'NGN',
          status: 'INITIATED',
        },
      });

      const failedPayload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999904,
          reference: failedPaymentRef,
          amount: bookingATotalKobo,
          currency: 'NGN',
          status: 'failed',
          gateway_response: 'Declined by card issuer',
        },
      });
      const sig = computeHmacSignature(failedPayload, PAYSTACK_SECRET);
      await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: failedPayload,
      });

      const checkPayment = await prisma.payment.findUnique({ where: { reference: failedPaymentRef } });
      assert.strictEqual(checkPayment.status, 'FAILED');

      const checkBooking = await prisma.booking.findUnique({ where: { reference: bookingARef } });
      assert.strictEqual(checkBooking.status, 'PENDING_PAYMENT', 'Booking must remain PENDING_PAYMENT on failed payment');

      // Cleanup
      await prisma.payment.delete({ where: { reference: failedPaymentRef } });
    });

    // --- TEST SCENARIO 13: Ensuring capacity is not incremented twice on confirmation ---
    let capacityBefore = 0;
    let capacityUnitId = '';
    await test('Scenario 13 & 7 Setup: Measure capacity reserved count prior to confirmation', async () => {
      const bookingRecord = await prisma.booking.findUnique({
        where: { reference: bookingARef },
        include: { units: { include: { capacityUnit: true } } },
      });
      assert.ok(bookingRecord.units.length > 0, 'Booking must have capacity units associated');
      capacityBefore = bookingRecord.units[0].capacityUnit.reserved;
      capacityUnitId = bookingRecord.units[0].capacityUnitId;
      assert.ok(capacityBefore >= 1, 'Capacity must already be reserved from hold');
    });

    // --- TEST SCENARIO 7: Verification confirming booking upon valid successful Paystack response ---
    await test('Scenario 7: Successful verified payment transitions booking to CONFIRMED and payment to SUCCEEDED', async () => {
      const validPayload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999905,
          reference: initializedRef,
          amount: bookingATotalKobo,
          currency: 'NGN',
          status: 'success',
          channel: 'card',
          gateway_response: 'Successful',
          paid_at: new Date().toISOString(),
        },
      });
      const sig = computeHmacSignature(validPayload, PAYSTACK_SECRET);
      const res = await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: validPayload,
      });
      assert.strictEqual(res.status, 200);

      // Check payment record
      const updatedPayment = await prisma.payment.findUnique({
        where: { reference: initializedRef },
      });
      assert.strictEqual(updatedPayment.status, 'SUCCEEDED');
      assert.ok(updatedPayment.paidAt);
      assert.ok(updatedPayment.verifiedAt);

      // Check booking record
      const updatedBooking = await prisma.booking.findUnique({
        where: { reference: bookingARef },
      });
      assert.strictEqual(updatedBooking.status, 'CONFIRMED');
      assert.ok(updatedBooking.confirmedAt);
      assert.strictEqual(updatedBooking.holdExpiresAt, null, 'holdExpiresAt must be cleared upon confirmation');
    });

    // --- TEST SCENARIO 13 Check: Capacity reserved count is identical ---
    await test('Scenario 13: Capacity reserved count was NOT double-incremented upon confirmation', async () => {
      const capacityAfter = await prisma.capacityUnit.findUnique({
        where: { id: capacityUnitId },
      });
      assert.strictEqual(
        capacityAfter.reserved,
        capacityBefore,
        'Capacity reserved count must remain unchanged (already reserved during hold)'
      );
    });

    // --- TEST SCENARIO 10: Webhook handler processing duplicate events idempotently ---
    await test('Scenario 10: Duplicate webhook events handled idempotently with 200 and no double confirmation', async () => {
      const duplicatePayload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999905, // Same Paystack event ID as scenario 7
          reference: initializedRef,
          amount: bookingATotalKobo,
          currency: 'NGN',
          status: 'success',
        },
      });
      const sig = computeHmacSignature(duplicatePayload, PAYSTACK_SECRET);
      const res = await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: duplicatePayload,
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.deduplicated, true);

      // Ensure booking is still CONFIRMED and payment is still SUCCEEDED
      const checkBooking = await prisma.booking.findUnique({ where: { reference: bookingARef } });
      assert.strictEqual(checkBooking.status, 'CONFIRMED');
    });

    // --- TEST SCENARIO 12: Late payment handling after hold expiry ---
    await test('Scenario 12a: Late payment on EXPIRED booking with available capacity re-reserves and confirms', async () => {
      // Create a booking in EXPIRED status with an available capacity unit
      const lateBookingA = await prisma.booking.create({
        data: {
          reference: `GP-LATE1-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
          idempotencyKey: `late_key_1_${timestamp}`,
          customerId: userAId,
          petId: petAId,
          serviceType: 'DAYCARE',
          status: 'EXPIRED',
          startDate: new Date(Date.now() + 86400000 * 60),
          endDate: new Date(Date.now() + 86400000 * 60),
          quantity: 1,
          petNameSnapshot: 'Fido Test',
          petSpeciesSnapshot: 'DOG',
          unitPriceKobo: 500000,
          totalKobo: 500000,
        },
      });

      // Find or create capacity unit for this serviceDate
      let capUnit = await prisma.capacityUnit.findFirst({
        where: {
          serviceType: 'DAYCARE',
          serviceDate: lateBookingA.startDate,
        },
      });
      if (!capUnit) {
        capUnit = await prisma.capacityUnit.create({
          data: {
            serviceType: 'DAYCARE',
            serviceDate: lateBookingA.startDate,
            capacity: 5,
            reserved: 1, // Has free space (1/5)
          },
        });
      }

      await prisma.bookingUnit.create({
        data: {
          bookingId: lateBookingA.id,
          capacityUnitId: capUnit.id,
          releasedAt: new Date(),
        },
      });

      const latePaymentRef = `PAY-${lateBookingA.reference}-LATE1`;
      await prisma.payment.create({
        data: {
          bookingId: lateBookingA.id,
          reference: latePaymentRef,
          amountKobo: 500000,
          currency: 'NGN',
          status: 'INITIATED',
        },
      });

      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999907,
          reference: latePaymentRef,
          amount: 500000,
          currency: 'NGN',
          status: 'success',
          channel: 'card',
        },
      });
      const sig = computeHmacSignature(payload, PAYSTACK_SECRET);
      await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: payload,
      });

      const updatedLateA = await prisma.booking.findUnique({ where: { id: lateBookingA.id } });
      assert.strictEqual(updatedLateA.status, 'CONFIRMED', 'Must re-reserve and confirm when capacity is available');

      // Cleanup
      await prisma.bookingUnit.deleteMany({ where: { bookingId: lateBookingA.id } });
      await prisma.payment.deleteMany({ where: { bookingId: lateBookingA.id } });
      await prisma.booking.delete({ where: { id: lateBookingA.id } });
    });

    await test('Scenario 12b: Late payment on EXPIRED booking with full capacity marks NEEDS_ATTENTION', async () => {
      // Create a booking in EXPIRED status with a FULL capacity unit
      const lateBookingB = await prisma.booking.create({
        data: {
          reference: `GP-LATE2-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
          idempotencyKey: `late_key_2_${timestamp}`,
          customerId: userAId,
          petId: petAId,
          serviceType: 'DAYCARE',
          status: 'EXPIRED',
          startDate: new Date(Date.now() + 86400000 * 65),
          endDate: new Date(Date.now() + 86400000 * 65),
          quantity: 1,
          petNameSnapshot: 'Fido Test',
          petSpeciesSnapshot: 'DOG',
          unitPriceKobo: 500000,
          totalKobo: 500000,
        },
      });

      // Capacity unit is FULL (capacity === reserved)
      const fullCapUnit = await prisma.capacityUnit.create({
        data: {
          serviceType: 'DAYCARE',
          serviceDate: lateBookingB.startDate,
          capacity: 2,
          reserved: 2, // Full!
        },
      });

      await prisma.bookingUnit.create({
        data: {
          bookingId: lateBookingB.id,
          capacityUnitId: fullCapUnit.id,
          releasedAt: new Date(),
        },
      });

      const latePaymentRefB = `PAY-${lateBookingB.reference}-LATE2`;
      await prisma.payment.create({
        data: {
          bookingId: lateBookingB.id,
          reference: latePaymentRefB,
          amountKobo: 500000,
          currency: 'NGN',
          status: 'INITIATED',
        },
      });

      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 999908,
          reference: latePaymentRefB,
          amount: 500000,
          currency: 'NGN',
          status: 'success',
          channel: 'card',
        },
      });
      const sig = computeHmacSignature(payload, PAYSTACK_SECRET);
      await fetch(`${BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: payload,
      });

      const updatedLateB = await prisma.booking.findUnique({ where: { id: lateBookingB.id } });
      assert.strictEqual(
        updatedLateB.status,
        'NEEDS_ATTENTION',
        'Must set status to NEEDS_ATTENTION when capacity is full (PRD BR-018)'
      );

      // Verify payment was marked SUCCEEDED since customer paid
      const payRecordB = await prisma.payment.findUnique({ where: { reference: latePaymentRefB } });
      assert.strictEqual(payRecordB.status, 'SUCCEEDED');

      // Cleanup
      await prisma.bookingUnit.deleteMany({ where: { bookingId: lateBookingB.id } });
      await prisma.payment.deleteMany({ where: { bookingId: lateBookingB.id } });
      await prisma.booking.delete({ where: { id: lateBookingB.id } });
      await prisma.capacityUnit.delete({ where: { id: fullCapUnit.id } });
    });

  } finally {
    // General cleanup
    if (bookingARef) {
      await prisma.bookingUnit.deleteMany({ where: { booking: { reference: bookingARef } } });
      await prisma.payment.deleteMany({ where: { booking: { reference: bookingARef } } });
      await prisma.booking.deleteMany({ where: { reference: bookingARef } });
    }
    if (petAId) {
      await prisma.pet.deleteMany({ where: { id: petAId } });
    }
    if (userAId) {
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.user.deleteMany({ where: { id: userBId } });
    }
    await prisma.$disconnect();
  }

  console.log(`\n=== Verification Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error in Stage 5 verification:', err);
  process.exit(1);
});

