/**
 * Stage 7.2 High-Priority Reliability Corrections Test Suite
 *
 * Targeted Tests:
 * Fix 1 — Retry Scheduling Enforcement:
 * 1. A FAILED record with future scheduledAt cannot be claimed.
 * 2. A FAILED record whose scheduledAt has passed can be claimed.
 * 3. A FAILED record with three attempts cannot be claimed.
 * 4. Concurrent claims on a claimable FAILED record allow only one worker to succeed.
 *
 * Fix 2 — Durable Awaited Fallback:
 * 5. POST /api/auth/signup awaits direct outbox fallback on inngest.send failure, completing delivery before response.
 * 6. POST /api/auth/resend-verification awaits direct outbox fallback on inngest.send failure, completing delivery before response.
 * 7. Direct fallback failures (e.g. SMTP down) are caught safely without crashing HTTP response or leaking secrets.
 * 8. Resend anti-enumeration response is strictly preserved when fallback runs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== Stage 7.2: High-Priority Reliability Corrections Suite ===\n');

const ROOT = path.resolve(__dirname, '..');
process.env.AUTH_SECRET = 'goodpets-test-secret-minimum-32-chars-long-12345';
process.env.VERIFICATION_CODE_SECRET = 'goodpets-verification-hmac-secret-at-least-32-chars!';
process.env.EMAIL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.EMAIL_ALLOWLIST = '*';
process.env.NODE_ENV = 'test';

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
      const candidates = [
        path.resolve(ROOT, mappedRel + '.ts'),
        path.resolve(ROOT, mappedRel + '.tsx'),
        path.resolve(ROOT, mappedRel, 'index.ts'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          return loadTsModule(path.relative(ROOT, c), customMocks);
        }
      }
    }
    return originalRequire(request);
  };

  mod._compile(transpiled.outputText, fullPath);
  return mod.exports;
}

function createMockPrisma() {
  const users = new Map();
  const authTokens = new Map();
  const emailOutbox = new Map();

  function makeTx() {
    return {
      authToken: {
        deleteMany: async () => ({ count: 0 }),
        updateMany: async () => ({ count: 0 }),
        create: async ({ data }) => {
          const id = 'tok-' + crypto.randomUUID();
          const record = { id, ...data, createdAt: new Date() };
          authTokens.set(id, record);
          return record;
        },
      },
      user: {
        create: async ({ data }) => {
          const id = 'usr-' + crypto.randomUUID();
          const record = { id, isActive: true, emailVerified: null, role: 'CUSTOMER', ...data, createdAt: new Date(), updatedAt: new Date() };
          users.set(id, record);
          return record;
        },
        findUnique: async ({ where }) => {
          if (where.id) return users.get(where.id) || null;
          if (where.email) {
            for (const u of users.values()) {
              if (u.email === where.email) return u;
            }
          }
          return null;
        },
      },
      emailOutbox: {
        create: async ({ data }) => {
          const id = 'obx-' + crypto.randomUUID();
          const record = {
            id,
            attempts: 0,
            status: 'PENDING',
            lastError: null,
            sentAt: null,
            scheduledAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          emailOutbox.set(id, record);
          return record;
        },
        findUnique: async ({ where }) => emailOutbox.get(where.id) || null,
        update: async ({ where, data }) => {
          const o = emailOutbox.get(where.id);
          if (!o) throw new Error('Outbox record not found');
          const updated = { ...o, ...data, updatedAt: new Date() };
          emailOutbox.set(where.id, updated);
          return updated;
        },
        updateMany: async ({ where, data }) => {
          let count = 0;
          const now = new Date();
          for (const [id, o] of emailOutbox.entries()) {
            if (where.id && o.id !== where.id) continue;
            let match = false;
            if (where.OR) {
              for (const cond of where.OR) {
                let subMatch = true;
                if (cond.status && o.status !== cond.status) subMatch = false;
                if (cond.updatedAt?.lt && o.updatedAt >= cond.updatedAt.lt) subMatch = false;
                if (cond.attempts?.lt !== undefined && o.attempts >= cond.attempts.lt) subMatch = false;
                if (cond.scheduledAt?.lte && o.scheduledAt > cond.scheduledAt.lte) subMatch = false;
                if (subMatch) {
                  match = true;
                  break;
                }
              }
            } else if (where.status && o.status === where.status) {
              match = true;
            }
            if (match) {
              const updated = { ...o, ...data, updatedAt: now };
              if (data.attempts?.increment) {
                updated.attempts = o.attempts + data.attempts.increment;
              }
              emailOutbox.set(id, updated);
              count++;
            }
          }
          return { count };
        },
      },
    };
  }

  const tx = makeTx();
  return {
    ...tx,
    $transaction: async (fn) => (typeof fn === 'function' ? fn(tx) : tx),
    _store: { users, authTokens, emailOutbox },
  };
}

async function runSuite() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  const mockPrisma = createMockPrisma();
  const outboxModule = loadTsModule('src/lib/outbox.ts', { '@/lib/prisma': mockPrisma });
  const inngestFnModule = loadTsModule('src/inngest/functions/send-verification-email.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/outbox': outboxModule,
  });

  // ==========================================
  // FIX 1: RETRY SCHEDULING ENFORCEMENT TESTS
  // ==========================================

  // 1. A FAILED record with a future scheduledAt cannot be claimed
  await test('1. FAILED record with future scheduledAt cannot be claimed (scheduledAt <= now enforced)', async () => {
    const futureTime = new Date(Date.now() + 60 * 1000); // 60s in future
    const record = await mockPrisma.emailOutbox.create({
      data: {
        userId: 'usr-1',
        toEmail: 'future@example.com',
        status: 'FAILED',
        attempts: 1,
        scheduledAt: futureTime,
        encryptedPayload: outboxModule.encryptTokenPayload('111222'),
      },
    });

    const claimed = await outboxModule.claimOutboxRecordForProcessing(record.id, mockPrisma);
    assert.strictEqual(claimed, null, 'Record with future scheduledAt must not be claimed');
    const unchanged = await mockPrisma.emailOutbox.findUnique({ where: { id: record.id } });
    assert.strictEqual(unchanged.status, 'FAILED', 'Status must remain FAILED');
    assert.strictEqual(unchanged.attempts, 1, 'Attempts must not increment');
  });

  // 2. A FAILED record whose scheduledAt has passed can be claimed
  await test('2. FAILED record whose scheduledAt has passed can be claimed for retry', async () => {
    const pastTime = new Date(Date.now() - 10 * 1000); // 10s in past
    const record = await mockPrisma.emailOutbox.create({
      data: {
        userId: 'usr-2',
        toEmail: 'past@example.com',
        status: 'FAILED',
        attempts: 1,
        scheduledAt: pastTime,
        encryptedPayload: outboxModule.encryptTokenPayload('222333'),
      },
    });

    const claimed = await outboxModule.claimOutboxRecordForProcessing(record.id, mockPrisma);
    assert(claimed, 'Record whose scheduledAt has elapsed must be claimable');
    assert.strictEqual(claimed.status, 'PROCESSING', 'Claimed record must transition to PROCESSING');
    assert.strictEqual(claimed.attempts, 2, 'Attempts must increment to 2');
  });

  // 3. A FAILED record with 3 attempts cannot be claimed even if scheduledAt has passed
  await test('3. FAILED record with 3 attempts cannot be claimed (max retries exhausted)', async () => {
    const pastTime = new Date(Date.now() - 10 * 1000);
    const record = await mockPrisma.emailOutbox.create({
      data: {
        userId: 'usr-3',
        toEmail: 'exhausted@example.com',
        status: 'FAILED',
        attempts: 3,
        scheduledAt: pastTime,
        encryptedPayload: outboxModule.encryptTokenPayload('333444'),
      },
    });

    const claimed = await outboxModule.claimOutboxRecordForProcessing(record.id, mockPrisma);
    assert.strictEqual(claimed, null, 'Record with 3 attempts must not be claimed');
  });

  // 4. Concurrent claims on a claimable FAILED record allow only one worker to succeed
  await test('4. Concurrent claims on ready FAILED record allow exactly 1 worker to claim', async () => {
    const pastTime = new Date(Date.now() - 5 * 1000);
    const record = await mockPrisma.emailOutbox.create({
      data: {
        userId: 'usr-4',
        toEmail: 'concurrent-retry@example.com',
        status: 'FAILED',
        attempts: 1,
        scheduledAt: pastTime,
        encryptedPayload: outboxModule.encryptTokenPayload('444555'),
      },
    });

    const [claimA, claimB] = await Promise.all([
      outboxModule.claimOutboxRecordForProcessing(record.id, mockPrisma),
      outboxModule.claimOutboxRecordForProcessing(record.id, mockPrisma),
    ]);

    const winnerCount = (claimA ? 1 : 0) + (claimB ? 1 : 0);
    assert.strictEqual(winnerCount, 1, 'Only one concurrent worker must claim the FAILED record');
  });

  // ==========================================
  // FIX 2: DURABLE AWAITED FALLBACK TESTS
  // ==========================================

  // 5. Signup awaits direct outbox fallback on inngest.send failure
  await test('5. POST /api/auth/signup awaits direct outbox fallback on inngest.send failure', async () => {
    let fallbackDelivered = false;
    let fallbackAwaitedBeforeResponse = false;

    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest connection refused');
      },
    };

    const mockInngestFn = {
      processOutboxVerificationEmail: async (outboxId) => {
        // Simulate async work (50ms)
        await new Promise((r) => setTimeout(r, 50));
        fallbackDelivered = true;
        // Mark in mock DB
        await mockPrisma.emailOutbox.update({
          where: { id: outboxId },
          data: { status: 'SENT', sentAt: new Date(), encryptedPayload: null },
        });
        return { success: true, status: 'SENT', outboxId };
      },
    };

    const signupRoute = loadTsModule('src/app/api/auth/signup/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/inngest/functions/send-verification-email': mockInngestFn,
      '@/lib/breached-password': { isPasswordBreached: async () => false },
      '@/lib/rate-limit': {
        getClientIp: () => '127.0.0.1',
        deriveRateLimitKey: (p, v) => `${p}:${v}`,
        reserveRateLimits: async () => {},
      },
    });

    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Margaret Hamilton',
        email: 'margaret@apollo.example',
        password: 'Apollo11Password!',
        confirmPassword: 'Apollo11Password!',
        agreeToTerms: true,
      }),
    });

    const res = await signupRoute.POST(req);
    // At the moment res is returned, fallbackDelivered MUST already be true because it was awaited!
    fallbackAwaitedBeforeResponse = fallbackDelivered;

    assert.strictEqual(res.status, 201, 'Signup returns HTTP 201');
    assert.strictEqual(fallbackAwaitedBeforeResponse, true, 'Fallback MUST be awaited before HTTP response returns');
  });

  // 6. Resend awaits direct outbox fallback on inngest.send failure
  await test('6. POST /api/auth/resend-verification awaits direct outbox fallback on inngest.send failure', async () => {
    let fallbackDelivered = false;

    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest unavailable');
      },
    };

    const mockInngestFn = {
      processOutboxVerificationEmail: async (outboxId) => {
        await new Promise((r) => setTimeout(r, 30));
        fallbackDelivered = true;
        return { success: true, status: 'SENT', outboxId };
      },
    };

    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/inngest/functions/send-verification-email': mockInngestFn,
      '@/lib/rate-limit': {
        deriveRateLimitKey: (p, v) => `${p}:${v}`,
        reserveRateLimits: async () => {},
      },
    });

    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'margaret@apollo.example' }),
    });

    const res = await resendRoute.POST(req);
    assert.strictEqual(res.status, 200, 'Resend returns HTTP 200');
    assert.strictEqual(fallbackDelivered, true, 'Fallback MUST be awaited before HTTP response returns');
  });

  // 7. Fallback failure handled safely without crashing HTTP response
  await test('7. Fallback failure (e.g. SMTP down) is handled safely without crashing response', async () => {
    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest unavailable');
      },
    };

    const mockInngestFnCrashing = {
      processOutboxVerificationEmail: async () => {
        throw new Error('SMTP connection timed out during fallback');
      },
    };

    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/inngest/functions/send-verification-email': mockInngestFnCrashing,
      '@/lib/rate-limit': {
        deriveRateLimitKey: (p, v) => `${p}:${v}`,
        reserveRateLimits: async () => {},
      },
    });

    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'margaret@apollo.example' }),
    });

    const res = await resendRoute.POST(req);
    assert.strictEqual(res.status, 200, 'Endpoint must still return HTTP 200 generic response');
    const body = await res.json();
    assert.strictEqual(body.success, true, 'Response must remain success: true');
  });

  // 8. Resend anti-enumeration response is strictly preserved when fallback runs
  await test('8. Resend anti-enumeration message is identical between existent and nonexistent emails', async () => {
    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest network error');
      },
    };

    const mockInngestFn = {
      processOutboxVerificationEmail: async () => ({ success: true }),
    };

    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/inngest/functions/send-verification-email': mockInngestFn,
      '@/lib/rate-limit': {
        deriveRateLimitKey: (p, v) => `${p}:${v}`,
        reserveRateLimits: async () => {},
      },
    });

    // Existent unverified customer
    const req1 = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'margaret@apollo.example' }),
    });
    const res1 = await resendRoute.POST(req1);

    // Nonexistent customer
    const req2 = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent-user@apollo.example' }),
    });
    const res2 = await resendRoute.POST(req2);

    const b1 = await res1.json();
    const b2 = await res2.json();
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(b1.message, b2.message, 'Anti-enumeration generic message must be strictly identical');
  });

  console.log(`\nResults: ${passed}/${total} reliability correction tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
