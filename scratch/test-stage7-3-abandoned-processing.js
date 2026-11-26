/**
 * GoodPets Task 4 Step 10: Stage 7.3 — Abandoned PROCESSING Recovery Test Suite
 *
 * Requirements Tested:
 * 1. PROCESSING record younger than stale threshold (< 5m) is NOT recovered.
 * 2. PROCESSING record older than stale threshold (>= 5m) IS recovered back to PENDING.
 * 3. Recovered record is eligible for redispatch even when attempts > 0.
 * 4. SENT records are NEVER recovered (remain SENT).
 * 5. FAILED records with future scheduledAt are NOT prematurely processed.
 * 6. A fresh PROCESSING lock does NOT result in a false successful completion (returns failure/retryable, not SKIPPED/success).
 * 7. Concurrent recovery executions do not create unsafe duplicate claims (CAS guarantees single claim).
 * 8. A recovered record can successfully complete delivery and become SENT.
 * 9. More than 25 abandoned records are eventually recovered across scheduled batches (bounded batching).
 * 10. Existing PENDING recovery (initial stranded records attempts=0) continues to work.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== Stage 7.3: Abandoned PROCESSING Recovery Suite ===\n');

const ROOT = path.resolve(__dirname, '..');
process.env.AUTH_SECRET = 'goodpets-test-secret-minimum-32-chars-long-12345';
process.env.VERIFICATION_CODE_SECRET = 'goodpets-verification-hmac-secret-at-least-32-chars!';
process.env.EMAIL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.EMAIL_ALLOWLIST = '*';
process.env.NODE_ENV = 'test';
process.env.INNGEST_DEV = '1';

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
  const emailOutbox = new Map();

  return {
    user: {
      create: async ({ data }) => {
        const id = 'usr-' + crypto.randomUUID();
        const record = { id, ...data };
        users.set(id, record);
        return record;
      },
      findUnique: async ({ where }) => users.get(where.id) || null,
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
      findMany: async ({ where, orderBy, take }) => {
        const results = [];
        const now = new Date();
        for (const o of emailOutbox.values()) {
          let match = true;
          if (where?.status && o.status !== where.status) match = false;
          if (where?.attempts?.lt !== undefined && o.attempts >= where.attempts.lt) match = false;
          if (where?.scheduledAt?.lte && o.scheduledAt > where.scheduledAt.lte) match = false;
          if (where?.createdAt?.lt && o.createdAt >= where.createdAt.lt) match = false;

          if (match && where?.OR) {
            let orMatch = false;
            for (const cond of where.OR) {
              let sub = true;
              if (cond.attempts === 0 && o.attempts !== 0) sub = false;
              if (cond.attempts?.gt !== undefined && o.attempts <= cond.attempts.gt) sub = false;
              if (cond.createdAt?.lt && o.createdAt >= cond.createdAt.lt) sub = false;
              if (sub) {
                orMatch = true;
                break;
              }
            }
            if (!orMatch) match = false;
          }

          if (match) {
            const user = users.get(o.userId);
            results.push({
              ...o,
              user: user ? { name: user.name } : null,
            });
          }
        }
        if (take) return results.slice(0, take);
        return results;
      },
      update: async ({ where, data }) => {
        const o = emailOutbox.get(where.id);
        if (!o) throw new Error('Not found');
        const updated = { ...o, ...data, updatedAt: new Date() };
        emailOutbox.set(where.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        const now = new Date();
        for (const [id, o] of emailOutbox.entries()) {
          if (where.id && o.id !== where.id) continue;
          let match = true;

          if (where.status && o.status !== where.status) match = false;
          if (where.updatedAt?.lt && o.updatedAt >= where.updatedAt.lt) match = false;
          if (where.attempts?.lt !== undefined && o.attempts >= where.attempts.lt) match = false;
          if (where.attempts?.gte !== undefined && o.attempts < where.attempts.gte) match = false;
          if (where.scheduledAt?.lte && o.scheduledAt > where.scheduledAt.lte) match = false;

          if (where.OR) {
            let orMatch = false;
            for (const cond of where.OR) {
              let sub = true;
              if (cond.status && o.status !== cond.status) sub = false;
              if (cond.updatedAt?.lt && o.updatedAt >= cond.updatedAt.lt) sub = false;
              if (cond.attempts?.lt !== undefined && o.attempts >= cond.attempts.lt) sub = false;
              if (cond.scheduledAt?.lte && o.scheduledAt > cond.scheduledAt.lte) sub = false;
              if (sub) {
                orMatch = true;
                break;
              }
            }
            if (!orMatch) match = false;
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
    _store: { users, emailOutbox },
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
  const recoveryModule = loadTsModule('src/inngest/functions/recover-stranded-outbox.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/outbox': outboxModule,
  });

  const testUser = await mockPrisma.user.create({
    data: { name: 'Grace Hopper', email: 'hopper@example.com' },
  });

  // TEST 1: PROCESSING record younger than the stale threshold is not recovered
  await test('1. PROCESSING record younger than stale threshold (< 5m) is NOT reset to PENDING', async () => {
    const freshRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'PROCESSING',
        attempts: 1,
        updatedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago (< 5m threshold)
        encryptedPayload: outboxModule.encryptTokenPayload('111111'),
      },
    });

    const resetCount = await outboxModule.recoverAbandonedOutboxRecords(5, mockPrisma);
    assert.strictEqual(resetCount, 0, 'Must not reset fresh PROCESSING records');

    const unchanged = await mockPrisma.emailOutbox.findUnique({ where: { id: freshRecord.id } });
    assert.strictEqual(unchanged.status, 'PROCESSING', 'Status must remain PROCESSING');
  });

  // TEST 2: PROCESSING record older than the threshold is recovered
  await test('2. PROCESSING record older than threshold (>= 5m) is reset to PENDING with attempts preserved', async () => {
    const staleRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'PROCESSING',
        attempts: 1,
        updatedAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago (>= 5m threshold)
        encryptedPayload: outboxModule.encryptTokenPayload('222222'),
      },
    });

    const resetCount = await outboxModule.recoverAbandonedOutboxRecords(5, mockPrisma);
    assert.strictEqual(resetCount, 1, 'Exactly 1 stale record must be reset');

    const recovered = await mockPrisma.emailOutbox.findUnique({ where: { id: staleRecord.id } });
    assert.strictEqual(recovered.status, 'PENDING', 'Stale record must be reset to PENDING');
    assert.strictEqual(recovered.attempts, 1, 'Attempts count must be preserved (1)');
    assert(recovered.scheduledAt <= new Date(), 'scheduledAt must be ready for immediate re-dispatch');
  });

  // TEST 3: Recovered record is eligible for redispatch even when attempts is greater than zero
  await test('3. Recovered record is eligible for redispatch even with attempts > 0', async () => {
    // We have recovered record with attempts=1 from Test 2
    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, 25, mockPrisma);
    assert(
      stranded.some((r) => r.attempts > 0 && r.status === 'PENDING'),
      'findStrandedPendingOutboxRecords must include recovered PENDING records with attempts > 0'
    );
  });

  // TEST 4: SENT records are never recovered
  await test('4. SENT records are NEVER reset or recovered', async () => {
    const sentRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'SENT',
        sentAt: new Date(),
        attempts: 1,
        updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
      },
    });

    await outboxModule.recoverAbandonedOutboxRecords(5, mockPrisma);
    const unchangedSent = await mockPrisma.emailOutbox.findUnique({ where: { id: sentRecord.id } });
    assert.strictEqual(unchangedSent.status, 'SENT', 'SENT status must remain untouched');

    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, 50, mockPrisma);
    assert.ok(!stranded.some((r) => r.id === sentRecord.id), 'SENT record must never be in stranded list');
  });

  // TEST 5: FAILED records with future scheduledAt are not prematurely processed
  await test('5. FAILED records with future scheduledAt are protected from premature processing', async () => {
    const futureRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'FAILED',
        attempts: 1,
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min in future
        encryptedPayload: outboxModule.encryptTokenPayload('555555'),
      },
    });

    // Neither recovery nor claim should touch it
    await outboxModule.recoverAbandonedOutboxRecords(5, mockPrisma);
    const claimed = await outboxModule.claimOutboxRecordForProcessing(futureRecord.id, mockPrisma);
    assert.strictEqual(claimed, null, 'Must not claim FAILED record before scheduledAt');

    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, 50, mockPrisma);
    assert.ok(!stranded.some((r) => r.id === futureRecord.id), 'FAILED record must not be in stranded query');
  });

  // TEST 6: A fresh PROCESSING lock does not result in a false successful completion
  await test('6. A fresh PROCESSING lock does NOT report success: true or complete as SKIPPED/success', async () => {
    const activeLock = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'PROCESSING',
        attempts: 1,
        updatedAt: new Date(), // Active right now
        encryptedPayload: outboxModule.encryptTokenPayload('666666'),
      },
    });

    const result = await inngestFnModule.processOutboxVerificationEmail(activeLock.id);
    assert.strictEqual(result.success, false, 'Fresh PROCESSING lock must NOT report success: true');
    assert.strictEqual(result.retryable, true, 'Result must indicate retryable');
    assert.strictEqual(result.reason, 'ALREADY_PROCESSING', 'Reason must be ALREADY_PROCESSING');
  });

  // TEST 7: Concurrent recovery executions do not create unsafe duplicate claims
  await test('7. Concurrent recovery executions: CAS ensures exactly 1 claim succeeds', async () => {
    const readyRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'PENDING',
        attempts: 1, // Recovered record
        scheduledAt: new Date(Date.now() - 1000),
        encryptedPayload: outboxModule.encryptTokenPayload('777777'),
      },
    });

    const [claimA, claimB] = await Promise.all([
      outboxModule.claimOutboxRecordForProcessing(readyRecord.id, mockPrisma),
      outboxModule.claimOutboxRecordForProcessing(readyRecord.id, mockPrisma),
    ]);

    const winnerCount = (claimA ? 1 : 0) + (claimB ? 1 : 0);
    assert.strictEqual(winnerCount, 1, 'Exactly one concurrent worker must claim the record');
  });

  // TEST 8: A recovered record can successfully complete delivery and become SENT
  await test('8. A recovered record can successfully complete delivery and become SENT with payload cleared', async () => {
    const recoveredRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: testUser.email,
        status: 'PENDING',
        attempts: 1, // Recovered
        scheduledAt: new Date(Date.now() - 1000),
        encryptedPayload: outboxModule.encryptTokenPayload('888888'),
      },
    });

    const sentMails = [];
    const mockTransporter = {
      sendMail: async (opts) => {
        sentMails.push(opts);
        return { messageId: 'msg-recovered-8' };
      },
    };

    const deliveryResult = await inngestFnModule.processOutboxVerificationEmail(recoveredRecord.id, {
      transporter: mockTransporter,
    });

    assert.strictEqual(deliveryResult.success, true, 'Delivery must succeed');
    assert.strictEqual(deliveryResult.status, 'SENT', 'Status must be SENT');

    const updated = await mockPrisma.emailOutbox.findUnique({ where: { id: recoveredRecord.id } });
    assert.strictEqual(updated.status, 'SENT', 'DB status must be SENT');
    assert.strictEqual(updated.encryptedPayload, null, 'Sensitive payload must be purged');
    assert.strictEqual(updated.attempts, 2, 'Attempts must reflect claim increment (1 -> 2)');
    assert.strictEqual(sentMails.length, 1, 'Exactly 1 email delivered');
  });

  // TEST 9: More than 25 abandoned records are eventually recovered across scheduled batches
  await test('9. Large queue (> 25 records) is cleanly drained across sequential recovery batches', async () => {
    // Clear outbox for this specific test
    mockPrisma._store.emailOutbox.clear();

    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    // Create 30 abandoned PROCESSING records
    for (let i = 0; i < 30; i++) {
      await mockPrisma.emailOutbox.create({
        data: {
          userId: testUser.id,
          toEmail: `batch-${i}@example.com`,
          status: 'PROCESSING',
          attempts: 1,
          updatedAt: tenMinsAgo,
          createdAt: tenMinsAgo,
          encryptedPayload: outboxModule.encryptTokenPayload('999999'),
        },
      });
    }

    const dispatchedBatches = [];
    const mockInngest = {
      send: async (events) => {
        dispatchedBatches.push(events);
      },
    };

    // First recovery run (Batch 1: 25 records)
    const run1 = await recoveryModule.runStrandedOutboxRecovery({
      thresholdMinutes: 5,
      batchLimit: 25,
      db: mockPrisma,
      inngestClient: mockInngest,
    });

    assert.strictEqual(run1.abandonedResetCount, 30, 'All 30 abandoned records reset to PENDING');
    assert.strictEqual(run1.recoveredCount, 25, 'Batch 1 capped at 25 records');

    // Simulate worker processing batch 1 to SENT
    for (const id of run1.outboxIds) {
      await mockPrisma.emailOutbox.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }

    // Second recovery run (Batch 2: remaining 5 records)
    const run2 = await recoveryModule.runStrandedOutboxRecovery({
      thresholdMinutes: 5,
      batchLimit: 25,
      db: mockPrisma,
      inngestClient: mockInngest,
    });

    assert.strictEqual(run2.recoveredCount, 5, 'Batch 2 drains the remaining 5 records');
  });

  // TEST 10: Existing PENDING recovery continues to work
  await test('10. Existing initial PENDING recovery (never attempted, attempts=0) continues to function', async () => {
    const oldInitialPending = await mockPrisma.emailOutbox.create({
      data: {
        userId: testUser.id,
        toEmail: 'initial@example.com',
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(Date.now() - 8 * 60 * 1000),
        encryptedPayload: outboxModule.encryptTokenPayload('101010'),
      },
    });

    const dispatched = [];
    const mockInngest = {
      send: async (events) => dispatched.push(...events),
    };

    const res = await recoveryModule.runStrandedOutboxRecovery({
      thresholdMinutes: 5,
      batchLimit: 25,
      db: mockPrisma,
      inngestClient: mockInngest,
    });

    assert(res.outboxIds.includes(oldInitialPending.id), 'Initial stranded record must be recovered');
    assert(dispatched.some((e) => e.data.outboxId === oldInitialPending.id), 'Event must be emitted');
  });

  console.log(`\nResults: ${passed}/${total} Stage 7.3 abandoned processing recovery tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
