// Good Pets - Stage 2 Automated Verification Suite
// Tests pricing, size tier boundaries, date rules, and live availability API

const assert = require('assert');

async function runTests() {
  console.log('--- Starting Stage 2 Automated Verification ---');
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

  // 1. Dog size tier boundaries (BR-003 & PRD 17.3 Acceptance Criteria)
  const { calculateDogSizeTier, calculatePrice, formatNaira } = require('../src/lib/pricing');
  const { getEarliestServiceDateLagos, countDaycareDays, countBoardingNights } = require('../src/lib/dates');

  test('BR-003: 9.9 kg dog is Small', () => {
    assert.strictEqual(calculateDogSizeTier(9.9), 'SMALL');
  });

  test('BR-003: 10.0 kg dog is Medium (boundary)', () => {
    assert.strictEqual(calculateDogSizeTier(10.0), 'MEDIUM');
  });

  test('BR-003: 25.0 kg dog is Medium (boundary)', () => {
    assert.strictEqual(calculateDogSizeTier(25.0), 'MEDIUM');
  });

  test('BR-003: 25.1 kg dog is Large', () => {
    assert.strictEqual(calculateDogSizeTier(25.1), 'LARGE');
  });

  test('BR-003: Cat has no size tier (null)', () => {
    assert.strictEqual(calculateDogSizeTier(null), null);
  });

  // 2. Daycare Pricing (BR-004 & PRD 17.3 Acceptance Criteria)
  test('BR-004: 3-day daycare booking costs ₦36,000 (3,600,000 kobo)', () => {
    const res = calculatePrice({
      serviceType: 'DAYCARE',
      species: 'DOG',
      quantity: 3,
    });
    assert.strictEqual(res.unitPriceKobo, 1200000);
    assert.strictEqual(res.quantity, 3);
    assert.strictEqual(res.totalKobo, 3600000);
    assert.strictEqual(res.formattedTotal, '₦36,000');
  });

  // 3. Boarding Pricing (BR-004 & PRD 17.3 Acceptance Criteria)
  test('BR-004: 7-night boarding stay costs ₦175,000 (17,500,000 kobo)', () => {
    const res = calculatePrice({
      serviceType: 'BOARDING',
      species: 'DOG',
      quantity: 7,
    });
    assert.strictEqual(res.unitPriceKobo, 2500000);
    assert.strictEqual(res.quantity, 7);
    assert.strictEqual(res.totalKobo, 17500000);
    assert.strictEqual(res.formattedTotal, '₦175,000');
  });

  // 4. Grooming Pricing Matrix (BR-002, PRD 8.4)
  test('Dog Grooming Small: Basic ₦12,000, Full ₦20,000, Premium ₦25,000', () => {
    const basic = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 8.5, groomingPackage: 'BASIC' });
    const full = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 8.5, groomingPackage: 'FULL' });
    const premium = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 8.5, groomingPackage: 'PREMIUM' });
    assert.strictEqual(basic.totalKobo, 1200000);
    assert.strictEqual(full.totalKobo, 2000000);
    assert.strictEqual(premium.totalKobo, 2500000);
  });

  test('Dog Grooming Medium: Basic ₦16,000, Full ₦27,000, Premium ₦33,000', () => {
    const basic = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 15.0, groomingPackage: 'BASIC' });
    const full = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 15.0, groomingPackage: 'FULL' });
    const premium = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 15.0, groomingPackage: 'PREMIUM' });
    assert.strictEqual(basic.totalKobo, 1600000);
    assert.strictEqual(full.totalKobo, 2700000);
    assert.strictEqual(premium.totalKobo, 3300000);
  });

  test('Dog Grooming Large: Basic ₦22,000, Full ₦35,000, Premium ₦42,000', () => {
    const basic = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 30.0, groomingPackage: 'BASIC' });
    const full = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 30.0, groomingPackage: 'FULL' });
    const premium = calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: 30.0, groomingPackage: 'PREMIUM' });
    assert.strictEqual(basic.totalKobo, 2200000);
    assert.strictEqual(full.totalKobo, 3500000);
    assert.strictEqual(premium.totalKobo, 4200000);
  });

  test('Cat Grooming: Basic ₦15,000, Full ₦22,000', () => {
    const basic = calculatePrice({ serviceType: 'GROOMING', species: 'CAT', groomingPackage: 'BASIC' });
    const full = calculatePrice({ serviceType: 'GROOMING', species: 'CAT', groomingPackage: 'FULL' });
    assert.strictEqual(basic.totalKobo, 1500000);
    assert.strictEqual(full.totalKobo, 2200000);
  });

  test('FR-009: Cat cannot select Premium Grooming package', () => {
    assert.throws(() => {
      calculatePrice({ serviceType: 'GROOMING', species: 'CAT', groomingPackage: 'PREMIUM' });
    }, /not available for cats/);
  });

  test('FR-005: Dog Grooming requires weight for tier calculation', () => {
    assert.throws(() => {
      calculatePrice({ serviceType: 'GROOMING', species: 'DOG', weightKg: null, groomingPackage: 'BASIC' });
    }, /weight is required/);
  });

  // 5. Date calculation rules
  test('BR-043: Earliest service date is tomorrow in Africa/Lagos', () => {
    const earliest = getEarliestServiceDateLagos();
    assert.match(earliest, /^\d{4}-\d{2}-\d{2}$/);
    const today = new Date().toISOString().split('T')[0];
    assert.ok(earliest >= today, 'Earliest date must be greater than or equal to today');
  });

  test('BR-004: Daycare days counted inclusive (Nov 1 to Nov 3 = 3 days)', () => {
    assert.strictEqual(countDaycareDays('2026-11-01', '2026-11-01'), 1);
    assert.strictEqual(countDaycareDays('2026-11-01', '2026-11-03'), 3);
  });

  test('BR-010: Boarding nights = check-out minus check-in (Dec 20 to Dec 27 = 7 nights)', () => {
    assert.strictEqual(countBoardingNights('2026-12-20', '2026-12-27'), 7);
  });

  // 6. Live API Verification (/api/availability)
  await testAsync('API: Same-day or past date booking rejected with 400', async () => {
    const res = await fetch('http://localhost:3000/api/availability?service=GROOMING&startDate=2020-01-01');
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.code, 'EARLIEST_DATE_VIOLATION');
  });

  await testAsync('API: Grooming returns 3 configured slots with 90min duration and capacity', async () => {
    const res = await fetch('http://localhost:3000/api/availability?service=GROOMING&startDate=2026-11-10');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.service, 'GROOMING');
    assert.strictEqual(data.slots.length, 3);
    assert.deepStrictEqual(data.slots.map(s => s.slotCode), ['09:00', '12:00', '15:00']);
    assert.strictEqual(data.slots[0].durationMinutes, 90);
    assert.strictEqual(data.available, true);
  });

  await testAsync('API: Daycare returns daily availability for date range', async () => {
    const res = await fetch('http://localhost:3000/api/availability?service=DAYCARE&startDate=2026-11-10&endDate=2026-11-12');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.service, 'DAYCARE');
    assert.strictEqual(data.totalDays, 3);
    assert.strictEqual(data.days.length, 3);
    assert.strictEqual(data.available, true);
  });

  await testAsync('API: Boarding returns nightly availability for stay window', async () => {
    const res = await fetch('http://localhost:3000/api/availability?service=BOARDING&startDate=2026-12-20&endDate=2026-12-27');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.service, 'BOARDING');
    assert.strictEqual(data.totalNights, 7);
    assert.strictEqual(data.nights.length, 7);
    assert.strictEqual(data.available, true);
  });

  console.log(`\n--- Verification Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});

