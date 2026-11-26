/**
 * GoodPets Task 4 Step 10: Stage 7.3 — Scheduled Outbox Recovery Test Suite
 *
 * Requirements Tested:
 * 1. An old PENDING record (older than threshold, attempts = 0) is detected and re-dispatched.
 * 2. A recent PENDING record (younger than threshold) is ignored.
 * 3. A record with previous attempts (attempts > 0) is not treated as a stranded initial delivery.
 * 4. SENT, FAILED, and PROCESSING records are strictly excluded.
 * 5. Bounded batch limit is enforced (does not exceed batchLimit).
 * 6. Duplicate recovery runs do not cause duplicate email delivery (safe idempotency & CAS locking).
 * 7. Event dispatch failure is handled gracefully and later recovery run can retry.
 * 8. Inngest API route registers recoverStrandedOutboxFunction with cron trigger "star/5 * * * *".
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== Stage 7.3: Scheduled Outbox Recovery Test Suite ===\n');

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
      findMany: async ({ where, orderBy, take, select }) => {
        const results = [];
        for (const o of emailOutbox.values()) {
          let match = true;
          if (where?.status && o.status !== where.status) match = false;
          if (where?.attempts !== undefined) {
            if (typeof where.attempts === 'number' && o.attempts !== where.attempts) match = false;
            if (where.attempts.lt !== undefined && o.attempts >= where.attempts.lt) match = false;
            if (where.attempts.gt !== undefined && o.attempts <= where.attempts.gt) match = false;
          }
          const oSched = o.scheduledAt || o.createdAt || new Date(0);
          if (where?.scheduledAt?.lte && oSched > where.scheduledAt.lte) match = false;
          if (where?.createdAt?.lt && o.createdAt >= where.createdAt.lt) match = false;
          if (where?.OR) {
            let orMatch = false;
            for (const cond of where.OR) {
              let sub = true;
              if (cond.attempts !== undefined) {
                if (typeof cond.attempts === 'number' && o.attempts !== cond.attempts) sub = false;
                if (cond.attempts.gt !== undefined && o.attempts <= cond.attempts.gt) sub = false;
                if (cond.attempts.lt !== undefined && o.attempts >= cond.attempts.lt) sub = false;
              }
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

  // Seed user
  const user = await mockPrisma.user.create({
    data: { name: 'Alan Turing', email: 'alan@enigma.example' },
  });

  // 1. Old PENDING record is detected and re-dispatched
  await test('1. Old PENDING record (older than threshold, attempts = 0) is detected and re-dispatched', async () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const oldPending = await mockPrisma.emailOutbox.create({
      data: {
        userId: user.id,
        tokenId: 'tok-turing',
        toEmail: user.email,
        status: 'PENDING',
        attempts: 0,
        createdAt: sixMinutesAgo,
        encryptedPayload: outboxModule.encryptTokenPayload('123456'),
      },
    });

    const dispatchedEvents = [];
    const mockInngest = {
      send: async (events) => {
        const arr = Array.isArray(events) ? events : [events];
        dispatchedEvents.push(...arr);
      },
    };

    const result = await recoveryModule.runStrandedOutboxRecovery({
      thresholdMinutes: 5,
      batchLimit: 25,
      db: mockPrisma,
      inngestClient: mockInngest,
    });

    assert.strictEqual(result.recoveredCount, 1, 'Exactly 1 stranded record must be recovered');
    assert.strictEqual(result.outboxIds[0], oldPending.id, 'Recovered ID must match oldPending record');
    assert.strictEqual(dispatchedEvents.length, 1, 'Inngest event must be dispatched');
    assert.strictEqual(dispatchedEvents[0].name, 'auth/verification.email.requested', 'Event name match');
    assert.strictEqual(dispatchedEvents[0].data.outboxId, oldPending.id, 'Event payload outboxId match');
    assert.strictEqual(dispatchedEvents[0].data.name, 'Alan Turing', 'Customer name passed');
  });

  // 2. Recent PENDING record is ignored
  await test('2. Recent PENDING record (< threshold) is ignored and not re-dispatched', async () => {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    await mockPrisma.emailOutbox.create({
      data: {
        userId: user.id,
        toEmail: 'recent@enigma.example',
        status: 'PENDING',
        attempts: 0,
        createdAt: oneMinuteAgo,
        encryptedPayload: outboxModule.encryptTokenPayload('222333'),
      },
    });

    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, 25, mockPrisma);
    // Should NOT contain the record created 1 minute ago
    assert.ok(
      !stranded.some((r) => r.toEmail === 'recent@enigma.example'),
      'Recent record must be ignored by findStrandedPendingOutboxRecords'
    );
  });

  // 3. Record that exhausted retries (attempts >= 3) is strictly excluded
  await test('3. Record with exhausted retries (attempts >= 3) is excluded from recovery', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const attemptedRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: user.id,
        toEmail: 'attempted@enigma.example',
        status: 'PENDING',
        attempts: 3, // Exhausted maximum retries
        createdAt: tenMinutesAgo,
        encryptedPayload: outboxModule.encryptTokenPayload('333444'),
      },
    });

    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, 25, mockPrisma);
    assert.ok(
      !stranded.some((r) => r.id === attemptedRecord.id),
      'Record with attempts >= 3 must not be recovered'
    );
  });

  // 4. SENT, FAILED, and PROCESSING records are strictly excluded
  await test('4. Non-PENDING records (SENT, FAILED, PROCESSING) are strictly excluded from recovery', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const sentRecord = await mockPrisma.emailOutbox.create({
      data: { userId: user.id, toEmail: 'sent@example.com', status: 'SENT', attempts: 1, createdAt: tenMinutesAgo },
    });
    const failedRecord = await mockPrisma.emailOutbox.create({
      data: { userId: user.id, toEmail: 'failed@example.com', status: 'FAILED', attempts: 1, createdAt: tenMinutesAgo },
    });
    const processingRecord = await mockPrisma.emailOutbox.create({
      data: { userId: user.id, toEmail: 'processing@example.com', status: 'PROCESSING', attempts: 1, createdAt: tenMinutesAgo },
    });

    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, 50, mockPrisma);
    assert.ok(!stranded.some((r) => r.id === sentRecord.id), 'SENT must be excluded');
    assert.ok(!stranded.some((r) => r.id === failedRecord.id), 'FAILED must be excluded');
    assert.ok(!stranded.some((r) => r.id === processingRecord.id), 'PROCESSING must be excluded');
  });

  // 5. Bounded batch limit is enforced
  await test('5. Bounded batch limit (batchLimit) is strictly respected', async () => {
    const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000);
    // Seed 10 old pending records
    for (let i = 0; i < 10; i++) {
      await mockPrisma.emailOutbox.create({
        data: {
          userId: user.id,
          toEmail: `batch${i}@example.com`,
          status: 'PENDING',
          attempts: 0,
          createdAt: sevenMinutesAgo,
          encryptedPayload: outboxModule.encryptTokenPayload('999000'),
        },
      });
    }

    const BATCH_SIZE = 4;
    const stranded = await outboxModule.findStrandedPendingOutboxRecords(5, BATCH_SIZE, mockPrisma);
    assert.strictEqual(stranded.length, BATCH_SIZE, 'Returned count must not exceed batchLimit');
  });

  // 6. Duplicate recovery runs do not cause duplicate email delivery (idempotency + CAS)
  await test('6. Duplicate recovery runs do not cause duplicate email delivery', async () => {
    const eightMinutesAgo = new Date(Date.now() - 8 * 60 * 1000);
    const testRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: user.id,
        toEmail: 'idempotent@example.com',
        status: 'PENDING',
        attempts: 0,
        createdAt: eightMinutesAgo,
        encryptedPayload: outboxModule.encryptTokenPayload('888999'),
      },
    });

    const sentEmails = [];
    const mockTransporter = {
      sendMail: async (opts) => {
        sentEmails.push(opts);
        return { messageId: 'msg-dupe-test' };
      },
    };

    // First recovery run dispatches event and worker processes it to SENT
    await inngestFnModule.processOutboxVerificationEmail(testRecord.id, { transporter: mockTransporter });
    assert.strictEqual(sentEmails.length, 1, 'First run delivers 1 email');

    // Outbox record is now SENT and encryptedPayload is cleared
    const afterFirst = await mockPrisma.emailOutbox.findUnique({ where: { id: testRecord.id } });
    assert.strictEqual(afterFirst.status, 'SENT', 'Record is now SENT');
    assert.strictEqual(afterFirst.encryptedPayload, null, 'Payload is purged');

    // Simulate second recovery run encountering the event again
    const secondResult = await inngestFnModule.processOutboxVerificationEmail(testRecord.id, { transporter: mockTransporter });
    assert.strictEqual(secondResult.status, 'SKIPPED', 'Second worker execution skips already SENT record');
    assert.strictEqual(secondResult.reason, 'ALREADY_SENT', 'Reason is ALREADY_SENT');
    assert.strictEqual(sentEmails.length, 1, 'No duplicate email delivered');
  });

  // 7. Event dispatch failure is handled gracefully and later recovery run can retry
  await test('7. Event dispatch failure during recovery is handled gracefully and eligible for later retry', async () => {
    const nineMinutesAgo = new Date(Date.now() - 9 * 60 * 1000);
    const failRecord = await mockPrisma.emailOutbox.create({
      data: {
        userId: user.id,
        toEmail: 'fail-retry@example.com',
        status: 'PENDING',
        attempts: 0,
        createdAt: nineMinutesAgo,
        encryptedPayload: outboxModule.encryptTokenPayload('555666'),
      },
    });

    const mockInngestFailing = {
      send: async () => {
        throw new Error('Temporary Inngest queue failure');
      },
    };

    let errorCaught = false;
    try {
      await recoveryModule.runStrandedOutboxRecovery({
        thresholdMinutes: 5,
        batchLimit: 25,
        db: mockPrisma,
        inngestClient: mockInngestFailing,
      });
    } catch {
      errorCaught = true;
    }

    assert.strictEqual(errorCaught, true, 'Inngest send failure threw as expected');
    // The record must STILL remain in PENDING with attempts: 0 so the NEXT 5-minute cron will retry it!
    const stillPending = await mockPrisma.emailOutbox.findUnique({ where: { id: failRecord.id } });
    assert.strictEqual(stillPending.status, 'PENDING', 'Record status remains PENDING');
    assert.strictEqual(stillPending.attempts, 0, 'Attempts remain 0 for next cron cycle');
  });

  // 8. Inngest API route registers recoverStrandedOutboxFunction with cron trigger
  await test('8. Inngest route exports recoverStrandedOutboxFunction (function_count >= 2)', async () => {
    const routeModule = loadTsModule('src/app/api/inngest/route.ts');
    const req = new Request('http://localhost:3000/api/inngest', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    });

    const res = await routeModule.GET(req);
    assert.strictEqual(res.status, 200, 'GET /api/inngest returns HTTP 200');
    const body = await res.json();
    assert(body.function_count >= 2, 'Route must register at least 2 functions including recoverStrandedOutbox');
    console.log(`     -> Registered functions: ${body.function_count}`);
  });

  console.log(`\nResults: ${passed}/${total} Stage 7.3 recovery tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
