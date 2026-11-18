/**
 * GoodPets Task 4, Step 8 — Rate Limiting & Throttling Automated Test Suite
 *
 * Modes:
 *   node scratch/test-rate-limits.js --unit   Runs offline unit & route tests against actual TypeScript sources
 *   node scratch/test-rate-limits.js --db     Runs live PostgreSQL transactional, concurrency & latency tests
 *
 * IMPORTANT (Zero-PII policy):
 *   All database lookups in --db mode derive HMAC keys rather than querying with raw emails/IPs.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { hash, verify } = require('@node-rs/argon2');

const ROOT = path.resolve(__dirname, '..');
const TEST_SECRET = 'goodpets-test-secret-key-minimum-32-chars-long-12345';

// ---------------------------------------------------------------------------
// TypeScript Loader for Direct Testing of src/**/*.ts Without Modifying Config
// ---------------------------------------------------------------------------
function loadTsModule(relPath, customMocks = {}) {
  const fullPath = path.resolve(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  });

  const mod = new Module(fullPath);
  mod.filename = fullPath;
  mod.paths = Module._nodeModulePaths(path.dirname(fullPath));

  const originalRequire = mod.require.bind(mod);
  mod.require = (request) => {
    if (Object.prototype.hasOwnProperty.call(customMocks, request)) {
      return customMocks[request];
    }
    if (request.startsWith('@/')) {
      const mappedRel = path.join('src', request.slice(2));
      const mappedTs = path.resolve(ROOT, mappedRel + '.ts');
      if (fs.existsSync(mappedTs)) {
        return loadTsModule(path.relative(ROOT, mappedTs), customMocks);
      }
    }
    return originalRequire(request);
  };

  mod._compile(transpiled.outputText, fullPath);
  return mod.exports;
}

// ---------------------------------------------------------------------------
// Minimal NextResponse / NextRequest Test Stubs
// ---------------------------------------------------------------------------
function createNextServerStub() {
  class MockNextResponse {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.headers = new Map(Object.entries(init.headers || {}));
      this.cookies = { set: () => {} };
    }
    async json() {
      return JSON.parse(this._body);
    }
    static json(data, init = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
  };
}

function makeRequest(body = {}, headersMap = {}, url = 'http://localhost:3000/api/test') {
  const lowered = new Map();
  for (const [k, v] of Object.entries(headersMap)) {
    lowered.set(k.toLowerCase(), v);
  }
  return {
    url,
    headers: {
      get(name) {
        return lowered.has(name.toLowerCase()) ? lowered.get(name.toLowerCase()) : null;
      },
    },
    async json() {
      return body;
    },
  };
}

// ---------------------------------------------------------------------------
// In-Memory Transactional Simulator of PostgreSQL "RateLimit" Table (--unit)
// ---------------------------------------------------------------------------
function createMockRateLimitDb() {
  let rows = new Map(); // key -> { key, windowStart: Date, count: number }
  let dbTimeMs = 1762770000000; // Fixed deterministic clock baseline
  let injectErrorOnCallNumber = null;
  let callCounter = 0;
  let decrementErrorInjected = false;

  function cloneRows() {
    const copy = new Map();
    for (const [k, v] of rows.entries()) {
      copy.set(k, { key: v.key, windowStart: new Date(v.windowStart.getTime()), count: v.count });
    }
    return copy;
  }

  function buildTx(workingRows) {
    return {
      async $queryRaw(strings, ...values) {
        const sql = strings.join('?');
        if (sql.includes('INSERT INTO "RateLimit"')) {
          callCounter++;
          if (injectErrorOnCallNumber !== null && callCounter === injectErrorOnCallNumber) {
            throw new Error('Simulated PostgreSQL connection failure mid-transaction');
          }
          const key = values[0];
          const windowSeconds = values[2];
          const now = new Date(dbTimeMs);
          const existing = workingRows.get(key);
          let entry;
          if (!existing || existing.windowStart.getTime() + windowSeconds * 1000 <= dbTimeMs) {
            entry = { key, windowStart: now, count: 1 };
          } else {
            entry = {
              key,
              windowStart: existing.windowStart,
              count: existing.count + 1,
            };
          }
          workingRows.set(key, entry);
          const remainingMs = entry.windowStart.getTime() + windowSeconds * 1000 - dbTimeMs;
          const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
          return [{ count: entry.count, windowStart: entry.windowStart, retryAfterSeconds }];
        }
        return [];
      },
      async $executeRaw(strings, ...values) {
        const sql = strings.join('?');
        if (sql.includes('UPDATE "RateLimit"')) {
          if (decrementErrorInjected) {
            throw new Error('Simulated PostgreSQL failure on decrement cleanup');
          }
          const key = values[0];
          const windowStart = values[1];
          const existing = workingRows.get(key);
          if (existing && existing.windowStart.getTime() === windowStart.getTime()) {
            existing.count = Math.max(0, existing.count - 1);
            return 1;
          }
          return 0;
        }
        if (sql.includes('DELETE FROM "RateLimit"')) {
          const cutoff = dbTimeMs - 24 * 3600 * 1000;
          let count = 0;
          for (const [k, v] of workingRows.entries()) {
            if (v.windowStart.getTime() < cutoff) {
              workingRows.delete(k);
              count++;
            }
          }
          return count;
        }
        return 0;
      },
    };
  }

  return {
    advanceTimeMs(ms) {
      dbTimeMs += ms;
    },
    setInjectErrorOnCall(n) {
      callCounter = 0;
      injectErrorOnCallNumber = n;
    },
    setDecrementError(flag) {
      decrementErrorInjected = flag;
    },
    getRawRows() {
      return rows;
    },
    clear() {
      rows.clear();
    },
    _txQueue: Promise.resolve(),
    $transaction(fn) {
      const run = async () => {
        const snapshot = cloneRows();
        const tx = buildTx(snapshot);
        const res = await fn(tx);
        rows = snapshot;
        return res;
      };
      const next = this._txQueue.then(run, run);
      this._txQueue = next.catch(() => {});
      return next;
    },
    $executeRaw(...args) {
      return buildTx(rows).$executeRaw(...args);
    },
    user: {
      _mockUsers: new Map(),
      async findUnique({ where }) {
        if (where.email) {
          return this._mockUsers.get(where.email) || null;
        }
        return null;
      },
      async create({ data }) {
        const u = { id: 'usr_new_1', ...data, createdAt: new Date(dbTimeMs), sessionVersion: 1 };
        this._mockUsers.set(data.email, u);
        return u;
      },
    },
    closure: { async findMany() { return []; } },
    capacityUnit: { async findMany() { return []; } },
  };
}

// ---------------------------------------------------------------------------
// UNIT & ROUTE LOGIC TESTS (--unit)
// ---------------------------------------------------------------------------
async function runUnitTests() {
  console.log('=== GoodPets Task 4 Step 8: Offline Unit & Transaction Tests (--unit) ===\n');

  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.AUTH_SECRET;
  process.env.NODE_ENV = 'test';
  process.env.AUTH_SECRET = TEST_SECRET;

  const mockDb = createMockRateLimitDb();
  const nextServerStub = createNextServerStub();
  let mockCapacityHoldBehavior = async () => ({
    isExisting: false,
    booking: {
      id: 'bk_1',
      reference: 'GP-ABC234',
      status: 'PENDING_PAYMENT',
      serviceType: 'DAYCARE',
      groomingPackage: null,
      slotCode: null,
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-01T00:00:00.000Z'),
      quantity: 1,
      petNameSnapshot: 'Luna',
      petSpeciesSnapshot: 'DOG',
      petWeightKgSnapshot: 12.5,
      sizeTierSnapshot: 'MEDIUM',
      unitPriceKobo: 1200000,
      totalKobo: 1200000,
      currency: 'NGN',
      holdExpiresAt: new Date('2026-12-01T00:15:00.000Z'),
      createdAt: new Date('2026-11-10T10:00:00.000Z'),
    },
  });

  let mockAuthUser = {
    id: 'usr_cust_1',
    customerId: '4821',
    role: 'CUSTOMER',
    sessionVersion: 1,
  };

  const validDummyHash =
    '$argon2id$v=19$m=19456,t=2,p=1$XtMpH3NFCda15Hxxh1NdDQ$+vzJvzMP9Bj1hvbJnd2w1dcBNP5Dr+Y8NQb63nQJqps';
  const validPwHash = await hash('CorrectPass123!', {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  mockDb.user._mockUsers.set('ada@example.com', {
    id: 'usr_cust_1',
    customerId: '4821',
    email: 'ada@example.com',
    name: 'Ada Obi',
    passwordHash: validPwHash,
    role: 'CUSTOMER',
    isActive: true,
    sessionVersion: 1,
  });

  const commonMocks = {
    'next/server': nextServerStub,
    '@/lib/prisma': mockDb,
    '@prisma/client': { ServiceType: { GROOMING: 'GROOMING', DAYCARE: 'DAYCARE', BOARDING: 'BOARDING' } },
    '@/lib/auth': {
      signSessionToken: () => 'mock-jwt-token',
      getSessionCookieOptions: () => ({ name: 'goodpets_session', httpOnly: true, path: '/' }),
      generateRandomCustomerId: () => '7391',
      requireUser: async () => mockAuthUser,
    },
    '@/lib/capacity': {
      createBookingWithCapacityHold: async (args) => mockCapacityHoldBehavior(args),
    },
  };

  const rl = loadTsModule('src/lib/rate-limit.ts', commonMocks);
  const signupRoute = loadTsModule('src/app/api/auth/signup/route.ts', commonMocks);
  const signinRoute = loadTsModule('src/app/api/auth/signin/route.ts', commonMocks);
  const availabilityRoute = loadTsModule('src/app/api/availability/route.ts', commonMocks);
  const bookingsRoute = loadTsModule('src/app/api/bookings/route.ts', commonMocks);

  let passed = 0;
  async function runCase(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err);
      process.exit(1);
    }
  }

  // 1. IP Validation & Production vs Development Header Handling
  await runCase('IP extraction: production trusts x-vercel-forwarded-for exclusively and rejects missing/ambiguous/malformed', async () => {
    assert.strictEqual(
      rl.extractClientIpFromHeaders(new Map([['x-vercel-forwarded-for', '198.51.100.7']]), true),
      '198.51.100.7'
    );
    assert.strictEqual(
      rl.extractClientIpFromHeaders(new Map([['x-vercel-forwarded-for', '2001:db8::1']]), true),
      '2001:db8::1'
    );
    assert.throws(
      () => rl.extractClientIpFromHeaders(new Map([['x-forwarded-for', '1.2.3.4'], ['x-real-ip', '1.2.3.4']]), true),
      rl.RateLimitClientIpError
    );
    assert.throws(
      () => rl.extractClientIpFromHeaders(new Map([['x-test-client-ip', '1.2.3.4']]), true),
      rl.RateLimitClientIpError
    );
    assert.throws(
      () => rl.extractClientIpFromHeaders(new Map([['x-vercel-forwarded-for', '1.2.3.4, 5.6.7.8']]), true),
      rl.RateLimitClientIpError
    );
    assert.throws(
      () => rl.extractClientIpFromHeaders(new Map([['x-vercel-forwarded-for', 'not-an-ip']]), true),
      rl.RateLimitClientIpError
    );
  });

  await runCase('IP extraction: development honors x-test-client-ip, rejects malformed override, defaults to 127.0.0.1', async () => {
    assert.strictEqual(
      rl.extractClientIpFromHeaders(new Map([['x-test-client-ip', '203.0.113.5']]), false),
      '203.0.113.5'
    );
    assert.throws(
      () => rl.extractClientIpFromHeaders(new Map([['x-test-client-ip', 'invalid']]), false),
      rl.RateLimitClientIpError
    );
    assert.strictEqual(
      rl.extractClientIpFromHeaders(new Map(), false),
      '127.0.0.1'
    );
  });

  // 2. HMAC Domain Separation & Secret Validation
  await runCase('HMAC domain separation produces unique 64-char hex keys per purpose and rejects missing/weak AUTH_SECRET', async () => {
    const emailKey = rl.deriveRateLimitKey('signin:email', '198.51.100.1');
    const ipKey = rl.deriveRateLimitKey('signin:ip', '198.51.100.1');
    const signupKey = rl.deriveRateLimitKey('signup:ip', '198.51.100.1');

    assert.match(emailKey, /^signin:email:[a-f0-9]{64}$/);
    assert.match(ipKey, /^signin:ip:[a-f0-9]{64}$/);
    assert.notStrictEqual(emailKey.split(':')[2], ipKey.split(':')[2]);
    assert.notStrictEqual(ipKey.split(':')[2], signupKey.split(':')[2]);

    process.env.AUTH_SECRET = 'too-short';
    assert.throws(() => rl.getRateLimitSecret(), rl.RateLimitConfigError);
    delete process.env.AUTH_SECRET;
    assert.throws(() => rl.getRateLimitSecret(), rl.RateLimitConfigError);

    process.env.AUTH_SECRET = TEST_SECRET;
  });

  // 3. Valid Argon2id Dummy Hash
  await runCase('Dummy Argon2id hash executes real verify() without decoding error', async () => {
    const res = await verify(validDummyHash, 'any-password');
    assert.strictEqual(res, false);
  });

  // 4. Single-counter limit & rollback (Signup 5/hr)
  await runCase('POST /api/auth/signup allows 5 requests/hr per IP, returns 429 on 6th with Retry-After, and rolls back 6th increment', async () => {
    mockDb.clear();
    const ip = '198.51.100.10';
    for (let i = 0; i < 5; i++) {
      const req = makeRequest({ name: 'Single', email: 'bad', password: '123', confirmPassword: '123', agreeToTerms: true }, { 'x-test-client-ip': ip });
      const res = await signupRoute.POST(req);
      assert.strictEqual(res.status, 400); // validation fails, but attempt counts
    }
    const res6 = await signupRoute.POST(makeRequest({}, { 'x-test-client-ip': ip }));
    assert.strictEqual(res6.status, 429);
    assert.ok(Number(res6.headers.get('Retry-After')) >= 1);
    const body6 = await res6.json();
    assert.strictEqual(body6.success, false);

    // Verify 6th speculative increment was rolled back (count remains 5)
    const key = rl.deriveRateLimitKey('signup:ip', ip);
    assert.strictEqual(mockDb.getRawRows().get(key).count, 5);
  });

  // 5. Availability 60/min
  await runCase('GET /api/availability enforces 60 req/min per IP and rolls back 61st increment', async () => {
    mockDb.clear();
    const ip = '198.51.100.20';
    for (let i = 0; i < 60; i++) {
      const req = makeRequest({}, { 'x-test-client-ip': ip }, 'http://localhost:3000/api/availability?service=INVALID');
      const res = await availabilityRoute.GET(req);
      assert.strictEqual(res.status, 400);
    }
    const res61 = await availabilityRoute.GET(makeRequest({}, { 'x-test-client-ip': ip }, 'http://localhost:3000/api/availability?service=DAYCARE'));
    assert.strictEqual(res61.status, 429);
    assert.ok(Number(res61.headers.get('Retry-After')) >= 1);
    const key = rl.deriveRateLimitKey('availability:ip', ip);
    assert.strictEqual(mockDb.getRawRows().get(key).count, 60);
  });

  // 6. Cross-counter transaction rollback on Sign-in (exhausted IP must not increment fresh email)
  await runCase('POST /api/auth/signin rolls back all counters when IP limit exceeded, leaving fresh email untouched', async () => {
    mockDb.clear();
    const ip = '198.51.100.30';
    for (let i = 0; i < 20; i++) {
      const req = makeRequest(
        { email: `attacker${i}@example.com`, customerId: '4821', password: 'wrong' },
        { 'x-test-client-ip': ip }
      );
      const res = await signinRoute.POST(req);
      assert.strictEqual(res.status, 401);
    }

    // 21st request from same IP with a brand-new victim email
    const victimEmail = 'victim@example.com';
    const res21 = await signinRoute.POST(
      makeRequest({ email: victimEmail, customerId: '4821', password: 'wrong' }, { 'x-test-client-ip': ip })
    );
    assert.strictEqual(res21.status, 429);
    assert.ok(Number(res21.headers.get('Retry-After')) >= 1);

    // Victim email key MUST NOT exist in RateLimit table
    const victimKey = rl.deriveRateLimitKey('signin:email', victimEmail);
    assert.strictEqual(mockDb.getRawRows().has(victimKey), false);
    const ipKey = rl.deriveRateLimitKey('signin:ip', ip);
    assert.strictEqual(mockDb.getRawRows().get(ipKey).count, 20);
  });

  // 7. Sign-in concurrency, failure retention, scoped decrement on success, and window rollover safety
  await runCase('POST /api/auth/signin retains failed counts, decrements own reservation on success, and never corrupts rolled-over windows', async () => {
    mockDb.clear();
    const ip = '198.51.100.40';
    const email = 'ada@example.com';

    // 3 prior failed attempts
    for (let i = 0; i < 3; i++) {
      const res = await signinRoute.POST(
        makeRequest({ email, customerId: '4821', password: 'WrongPassword!' }, { 'x-test-client-ip': ip })
      );
      assert.strictEqual(res.status, 401);
    }

    const emailKey = rl.deriveRateLimitKey('signin:email', email);
    assert.strictEqual(mockDb.getRawRows().get(emailKey).count, 3);

    // Concurrent mix: 1 success + 1 failure simultaneously
    const [resSucc, resFail] = await Promise.all([
      signinRoute.POST(makeRequest({ email, customerId: '4821', password: 'CorrectPass123!' }, { 'x-test-client-ip': ip })),
      signinRoute.POST(makeRequest({ email, customerId: '4821', password: 'WrongPassword!' }, { 'x-test-client-ip': ip })),
    ]);
    assert.strictEqual(resSucc.status, 200);
    assert.strictEqual(resFail.status, 401);

    // Count must be 3 + 1 (failure) = 4 (success rolled back only its own reservation!)
    assert.strictEqual(mockDb.getRawRows().get(emailKey).count, 4);

    // Test window rollover safety on decrementRateLimits
    const oldWindow = mockDb.getRawRows().get(emailKey).windowStart;
    mockDb.advanceTimeMs(901 * 1000); // Move past 15-minute window
    await rl.reserveRateLimits([{ key: emailKey, limit: 5, windowSeconds: 900 }]);
    assert.strictEqual(mockDb.getRawRows().get(emailKey).count, 1);

    // Attempting to decrement with the stale oldWindow must match 0 rows and leave new window at 1
    await rl.decrementRateLimits([{ key: emailKey, windowStart: oldWindow }]);
    assert.strictEqual(mockDb.getRawRows().get(emailKey).count, 1);
  });

  // 8. Sign-in cleanup failure logs safely without hiding or crashing authenticated user
  await runCase('POST /api/auth/signin logs safely and succeeds (200) if post-auth decrement cleanup fails', async () => {
    mockDb.clear();
    mockDb.setDecrementError(true);
    const origError = console.error;
    const capturedLogs = [];
    console.error = (...args) => capturedLogs.push(args.join(' '));
    try {
      const res = await signinRoute.POST(
        makeRequest({ email: 'ada@example.com', customerId: '4821', password: 'CorrectPass123!' }, { 'x-test-client-ip': '198.51.100.41' })
      );
      assert.strictEqual(res.status, 200);
      assert.ok(capturedLogs.some((l) => l.includes('RateLimit cleanup failed')));
      assert.ok(!capturedLogs.some((l) => l.includes('ada@example.com') || l.includes('198.51.100.41')));
    } finally {
      console.error = origError;
      mockDb.setDecrementError(false);
    }
  });

  // 9. Database failure rollback & fail-closed HTTP 503
  await runCase('Database error mid-transaction rolls back partial increments and returns HTTP 503', async () => {
    mockDb.clear();
    mockDb.setInjectErrorOnCall(2); // Fail on 2nd upsert inside transaction
    const origError = console.error;
    console.error = () => {};
    try {
      const res = await signinRoute.POST(
        makeRequest({ email: 'ada@example.com', customerId: '4821', password: 'CorrectPass123!' }, { 'x-test-client-ip': '198.51.100.50' })
      );
      assert.strictEqual(res.status, 503);
      assert.strictEqual(mockDb.getRawRows().size, 0); // Complete rollback!
    } finally {
      console.error = origError;
      mockDb.setInjectErrorOnCall(null);
    }
  });

  // 10. Missing / weak secret returns HTTP 503 fail-closed
  await runCase('Missing AUTH_SECRET returns HTTP 503 fail-closed without leaking secret details', async () => {
    delete process.env.AUTH_SECRET;
    const origError = console.error;
    console.error = () => {};
    try {
      const res = await signupRoute.POST(makeRequest({}, { 'x-test-client-ip': '198.51.100.60' }));
      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.error, 'Service temporarily unavailable. Please try again shortly.');
    } finally {
      console.error = origError;
      process.env.AUTH_SECRET = TEST_SECRET;
    }
  });

  // 11. Booking limits, failure rollback & HOLD_LIMIT_REACHED preservation
  await runCase('POST /api/bookings retains counts on success, rolls back on failure/HOLD_LIMIT_REACHED, and enforces 10/hr user limit', async () => {
    mockDb.clear();
    const ip = '198.51.100.70';
    const userKey = rl.deriveRateLimitKey('booking:user', mockAuthUser.id);
    const ipKey = rl.deriveRateLimitKey('booking:ip', ip);

    // Success retains counts
    const resOk = await bookingsRoute.POST(
      makeRequest({ idempotencyKey: 'idem_1' }, { 'x-test-client-ip': ip })
    );
    assert.strictEqual(resOk.status, 201);
    assert.strictEqual(mockDb.getRawRows().get(userKey).count, 1);
    assert.strictEqual(mockDb.getRawRows().get(ipKey).count, 1);

    // HOLD_LIMIT_REACHED preserves 429 + code AND rolls back booking rate-limit increment
    mockCapacityHoldBehavior = async () => {
      const err = new Error('You already have 2 active bookings awaiting payment.');
      err.code = 'HOLD_LIMIT_REACHED';
      err.statusCode = 429;
      throw err;
    };
    const origError = console.error;
    console.error = () => {};
    try {
      const resHold = await bookingsRoute.POST(
        makeRequest({ idempotencyKey: 'idem_2' }, { 'x-test-client-ip': ip })
      );
      assert.strictEqual(resHold.status, 429);
      const bodyHold = await resHold.json();
      assert.strictEqual(bodyHold.code, 'HOLD_LIMIT_REACHED');
      assert.strictEqual(mockDb.getRawRows().get(userKey).count, 1); // Rolled back!
      assert.strictEqual(mockDb.getRawRows().get(ipKey).count, 1);   // Rolled back!
    } finally {
      console.error = origError;
    }

    // Restore success behavior and exhaust 10/hr user limit (9 more successes -> 10 total)
    mockCapacityHoldBehavior = async () => ({
      isExisting: false,
      booking: {
        id: 'bk_n', reference: 'GP-XYZ123', status: 'PENDING_PAYMENT', serviceType: 'DAYCARE',
        groomingPackage: null, slotCode: null, startDate: new Date(), endDate: new Date(),
        quantity: 1, petNameSnapshot: 'Luna', petSpeciesSnapshot: 'DOG', petWeightKgSnapshot: 12,
        sizeTierSnapshot: 'MEDIUM', unitPriceKobo: 1200000, totalKobo: 1200000, currency: 'NGN',
        holdExpiresAt: new Date(), createdAt: new Date(),
      },
    });
    for (let i = 0; i < 9; i++) {
      const r = await bookingsRoute.POST(makeRequest({ idempotencyKey: `idem_ok_${i}` }, { 'x-test-client-ip': ip }));
      assert.strictEqual(r.status, 201);
    }
    const res11 = await bookingsRoute.POST(makeRequest({ idempotencyKey: 'idem_11' }, { 'x-test-client-ip': ip }));
    assert.strictEqual(res11.status, 429);
    const body11 = await res11.json();
    assert.strictEqual(body11.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(Number(res11.headers.get('Retry-After')) >= 1);
  });

  // 12. Zero-PII Check in stored RateLimit keys
  await runCase('Zero raw emails, raw IPs, or raw user IDs exist in RateLimit keys', async () => {
    for (const key of mockDb.getRawRows().keys()) {
      assert.ok(!key.includes('@'), 'Key must not contain email');
      assert.ok(!key.includes('198.51.100.'), 'Key must not contain raw IP');
      assert.ok(!key.includes('usr_cust_1'), 'Key must not contain raw user ID');
    }
  });

  // 13. Cleanup Helper
  await runCase('cleanupExpiredRateLimits deletes only windows older than 24 hours', async () => {
    mockDb.advanceTimeMs(25 * 3600 * 1000);
    const deleted = await rl.cleanupExpiredRateLimits(mockDb);
    assert.ok(deleted >= 1);
    assert.strictEqual(mockDb.getRawRows().size, 0);
  });

  process.env.NODE_ENV = prevEnv;
  if (prevSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = prevSecret;

  console.log(`\nAll ${passed} offline unit & transaction verification checks passed!`);
}

// ---------------------------------------------------------------------------
// LIVE POSTGRESQL DATABASE INTEGRATION TESTS (--db)
// Run manually by the owner against task4_migrations_lab
// ---------------------------------------------------------------------------
async function runDatabaseTests() {
  console.log('=== GoodPets Task 4 Step 8: Live PostgreSQL RateLimit Tests (--db) ===\n');

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    process.env.AUTH_SECRET = TEST_SECRET;
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const rl = loadTsModule('src/lib/rate-limit.ts', {
    '@/lib/prisma': prisma,
    'next/server': createNextServerStub(),
  });

  const runId = crypto.randomUUID().slice(0, 8);
  const testEmail = `ratelimit-test-${runId}@example.com`;
  const testIp = '198.51.100.240';
  const keysToClean = [];
  const timingsSingle = [];
  const timingsMulti = [];

  try {
    // 1. Single-counter DB reserve & rollback on exceed
    const availKey = rl.deriveRateLimitKey('availability:ip', `${testIp}-${runId}`);
    keysToClean.push(availKey);

    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await rl.reserveRateLimits([{ key: availKey, limit: 3, windowSeconds: 60 }]);
      timingsSingle.push(performance.now() - t0);
    }

    let exceeded = false;
    try {
      await rl.reserveRateLimits([{ key: availKey, limit: 3, windowSeconds: 60 }]);
    } catch (err) {
      if (err instanceof rl.RateLimitExceededError) {
        exceeded = true;
        assert.ok(err.retryAfterSeconds >= 1 && err.retryAfterSeconds <= 60);
      }
    }
    assert.strictEqual(exceeded, true, '4th request must throw RateLimitExceededError');

    const checkRow = await prisma.$queryRaw`SELECT "count" FROM "RateLimit" WHERE "key" = ${availKey}`;
    assert.strictEqual(Number(checkRow[0].count), 3, '4th failed increment must roll back to 3');
    console.log('[PASS] Live DB single-counter limit, Retry-After (PostgreSQL NOW()), and rollback');

    // 2. Multi-counter transaction rollback + concurrent burst test
    const emailKey = rl.deriveRateLimitKey('signin:email', testEmail);
    const ipKey = rl.deriveRateLimitKey('signin:ip', `${testIp}-${runId}`);
    keysToClean.push(emailKey, ipKey);

    // Parallel burst of 8 concurrent requests with limit 5 on email, 20 on IP
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, async () => {
        const t0 = performance.now();
        try {
          const r = await rl.reserveRateLimits([
            { key: emailKey, limit: 5, windowSeconds: 900 },
            { key: ipKey, limit: 20, windowSeconds: 900 },
          ]);
          timingsMulti.push(performance.now() - t0);
          return r;
        } catch (e) {
          timingsMulti.push(performance.now() - t0);
          throw e;
        }
      })
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected' && r.reason instanceof rl.RateLimitExceededError);
    assert.strictEqual(fulfilled.length, 5, 'Exactly 5 parallel requests must succeed');
    assert.strictEqual(rejected.length, 3, 'Exactly 3 parallel requests must be rejected with 429');

    // Verify neither email nor IP leaked an increment from the 3 rejected transactions!
    const emailRow = await prisma.$queryRaw`SELECT "count" FROM "RateLimit" WHERE "key" = ${emailKey}`;
    const ipRow = await prisma.$queryRaw`SELECT "count" FROM "RateLimit" WHERE "key" = ${ipKey}`;
    assert.strictEqual(Number(emailRow[0].count), 5, 'Email count must be strictly 5');
    assert.strictEqual(Number(ipRow[0].count), 5, 'IP count must also be strictly 5 (no leaked cross-counter increments)');
    console.log('[PASS] Live DB parallel Promise.all concurrency & atomic cross-counter rollback');

    // 3. Scoped decrement check
    await rl.decrementRateLimits(fulfilled[0].value);
    const emailAfterDec = await prisma.$queryRaw`SELECT "count" FROM "RateLimit" WHERE "key" = ${emailKey}`;
    assert.strictEqual(Number(emailAfterDec[0].count), 4, 'Scoped decrement must reduce count by 1');
    console.log('[PASS] Live DB scoped decrement');

    // 4. Zero-PII check (using HMAC-derived keys only)
    for (const k of keysToClean) {
      assert.ok(!k.includes(testEmail) && !k.includes(testIp), 'Key must contain zero PII');
    }
    console.log('[PASS] Zero-PII HMAC keys verified');

    // 5. Measured latency summary
    const avg = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
    const max = (arr) => Math.max(...arr).toFixed(2);
    console.log(`\nMeasured PostgreSQL Latency:`);
    console.log(`  Single-counter upsert: avg=${avg(timingsSingle)}ms, max=${max(timingsSingle)}ms (n=${timingsSingle.length})`);
    console.log(`  Multi-counter concurrent tx: avg=${avg(timingsMulti)}ms, max=${max(timingsMulti)}ms (n=${timingsMulti.length})`);
  } finally {
    for (const k of keysToClean) {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${k}`.catch(() => {});
    }
    await prisma.$disconnect();
  }
}

const mode = process.argv.includes('--db') ? 'db' : 'unit';
(mode === 'db' ? runDatabaseTests() : runUnitTests()).catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
