/**
 * GoodPets Task 4 Step 10: Stage 7.4 — Welcome Email Background Job Test Suite
 *
 * Requirements Tested:
 * 1. Successful verification creates a welcome email outbox record.
 * 2. Failed verification does not create a welcome email.
 * 3. Reusing a verification code does not create another welcome email.
 * 4. Repeated verification requests do not create duplicate welcome emails.
 * 5. The verification API does not wait for SMTP delivery (returns immediately).
 * 6. Inngest dispatch failure leaves a recoverable outbox record in PENDING state.
 * 7. Welcome email is delivered by the background worker.
 * 8. Worker retries handle transient failures.
 * 9. Already-SENT welcome emails are not delivered again.
 * 10. Existing verification email functionality remains unaffected.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== Stage 7.4: Welcome Email Background Job Suite ===\n');

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
  const authTokens = new Map();
  const emailOutbox = new Map();

  function makeTx() {
    return {
      user: {
        create: async ({ data }) => {
          const id = 'usr-' + crypto.randomUUID();
          const record = { id, emailVerified: null, ...data };
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
        update: async ({ where, data }) => {
          const u = users.get(where.id);
          if (!u) throw new Error('User not found');
          const updated = { ...u, ...data, updatedAt: new Date() };
          users.set(where.id, updated);
          return updated;
        },
      },
      authToken: {
        create: async ({ data }) => {
          const id = 'tok-' + crypto.randomUUID();
          const record = { id, ...data, createdAt: new Date() };
          authTokens.set(id, record);
          return record;
        },
        findFirst: async ({ where }) => {
          for (const t of authTokens.values()) {
            let match = true;
            if (where.userId && t.userId !== where.userId) match = false;
            if (where.tokenHash && t.tokenHash !== where.tokenHash) match = false;
            if (where.purpose && t.purpose !== where.purpose) match = false;
            if (match) return t;
          }
          return null;
        },
        findUnique: async ({ where }) => {
          if (where.id) return authTokens.get(where.id) || null;
          if (where.tokenHash) {
            for (const t of authTokens.values()) {
              if (t.tokenHash === where.tokenHash) return t;
            }
          }
          return null;
        },
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const [id, t] of authTokens.entries()) {
            let match = true;
            if (where.userId && t.userId !== where.userId) match = false;
            if (where.tokenHash && t.tokenHash !== where.tokenHash) match = false;
            if (where.purpose && t.purpose !== where.purpose) match = false;
            if (where.usedAt === null && t.usedAt !== null) match = false;
            if (where.expiresAt?.gt && t.expiresAt <= where.expiresAt.gt) match = false;
            if (match) {
              authTokens.set(id, { ...t, ...data });
              count++;
            }
          }
          return { count };
        },
        deleteMany: async ({ where }) => {
          let count = 0;
          for (const [id, t] of authTokens.entries()) {
            let match = true;
            if (where.userId && t.userId !== where.userId) match = false;
            if (where.tokenHash && t.tokenHash !== where.tokenHash) match = false;
            if (match) {
              authTokens.delete(id);
              count++;
            }
          }
          return { count };
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
        findFirst: async ({ where }) => {
          for (const o of emailOutbox.values()) {
            let match = true;
            if (where.userId && o.userId !== where.userId) match = false;
            if (where.tokenId === null && o.tokenId !== null) match = false;
            if (where.tokenId && o.tokenId !== where.tokenId) match = false;
            if (match) return o;
          }
          return null;
        },
        findUnique: async ({ where }) => emailOutbox.get(where.id) || null,
        findMany: async ({ where, orderBy, take }) => {
          const results = [];
          for (const o of emailOutbox.values()) {
            let match = true;
            if (where?.status && o.status !== where.status) match = false;
            if (where?.attempts?.lt !== undefined && o.attempts >= where.attempts.lt) match = false;
            const oSched = o.scheduledAt || o.createdAt || new Date(0);
            if (where?.scheduledAt?.lte && oSched > where.scheduledAt.lte) match = false;
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
            let match = false;

            if (where.OR) {
              for (const cond of where.OR) {
                let subMatch = true;
                if (cond.status && o.status !== cond.status) subMatch = false;
                if (cond.updatedAt?.lt && o.updatedAt >= cond.updatedAt.lt) subMatch = false;
                if (cond.attempts?.lt !== undefined && o.attempts >= cond.attempts.lt) subMatch = false;
                const oSched = o.scheduledAt || o.createdAt || new Date(0);
                if (cond.scheduledAt?.lte && oSched > cond.scheduledAt.lte) subMatch = false;
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
    $transaction: async (fn) => fn(tx),
    _store: { users, authTokens, emailOutbox },
  };
}

function getModules(mockPrisma) {
  const outboxModule = loadTsModule('src/lib/outbox.ts', { '@/lib/prisma': mockPrisma });
  const tokensModule = loadTsModule('src/lib/tokens.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/outbox': outboxModule,
  });
  const emailModule = loadTsModule('src/lib/email.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/outbox': outboxModule,
  });
  const welcomeJobModule = loadTsModule('src/inngest/functions/send-welcome-email.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/outbox': outboxModule,
    '@/lib/email': emailModule,
  });
  const verifJobModule = loadTsModule('src/inngest/functions/send-verification-email.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/outbox': outboxModule,
    '@/lib/email': emailModule,
  });
  return { outboxModule, tokensModule, emailModule, welcomeJobModule, verifJobModule };
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
      console.error(`[FAIL] ${name}: ${err.message}`);
      if (err.stack) console.error(err.stack);
    }
  }

  // 1. Successful verification creates a welcome email outbox record
  await test('1. Successful verification creates a welcome email outbox record', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, tokensModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'ada@welcome.example',
        name: 'Ada Lovelace',
      },
    });

    const code = '123456';
    await tokensModule.createVerificationCodeRecord(user.id, code, mockPrisma);

    const result = await tokensModule.consumeVerificationCode('ada@welcome.example', code, mockPrisma);

    assert(result.welcomeOutboxId, 'welcomeOutboxId must be returned on successful verification');
    const outboxRecord = await mockPrisma.emailOutbox.findUnique({ where: { id: result.welcomeOutboxId } });
    assert.strictEqual(outboxRecord.userId, user.id, 'Outbox user ID matches');
    assert.strictEqual(outboxRecord.toEmail, 'ada@welcome.example', 'Outbox toEmail matches');
    assert.strictEqual(outboxRecord.tokenId, null, 'tokenId is strictly null for welcome emails');
    assert.strictEqual(outboxRecord.status, 'PENDING', 'Initial outbox status is PENDING');
    assert(outboxRecord.encryptedPayload, 'Encrypted payload is stored');
  });

  // 2. Failed verification does not create a welcome email
  await test('2. Failed verification does not create a welcome email', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'fail@welcome.example',
        name: 'Fail Test',
      },
    });

    await tokensModule.createVerificationCodeRecord(user.id, '111222', mockPrisma);

    let errorThrown = false;
    try {
      await tokensModule.consumeVerificationCode('fail@welcome.example', '999999', mockPrisma); // Wrong code
    } catch {
      errorThrown = true;
    }

    assert(errorThrown, 'Wrong code throws error');
    // Ensure zero welcome outbox records exist
    let welcomeCount = 0;
    for (const o of mockPrisma._store.emailOutbox.values()) {
      if (o.userId === user.id && o.tokenId === null) welcomeCount++;
    }
    assert.strictEqual(welcomeCount, 0, 'No welcome email outbox record created on failed verification');
  });

  // 3. Reusing a verification code does not create another welcome email
  await test('3. Reusing a verification code does not create another welcome email', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'reuse@welcome.example',
        name: 'Reuse Test',
      },
    });

    const code = '333444';
    await tokensModule.createVerificationCodeRecord(user.id, code, mockPrisma);

    // First use succeeds
    const firstResult = await tokensModule.consumeVerificationCode('reuse@welcome.example', code, mockPrisma);
    assert(firstResult.welcomeOutboxId, 'First consumption creates welcome outbox');

    // Second use throws TokenReusedError
    let reusedThrown = false;
    try {
      await tokensModule.consumeVerificationCode('reuse@welcome.example', code, mockPrisma);
    } catch (err) {
      if (err.name === 'TokenReusedError') reusedThrown = true;
    }

    assert(reusedThrown, 'Reusing code throws TokenReusedError');
    // Count welcome outbox records
    let welcomeCount = 0;
    for (const o of mockPrisma._store.emailOutbox.values()) {
      if (o.userId === user.id && o.tokenId === null) welcomeCount++;
    }
    assert.strictEqual(welcomeCount, 1, 'Exactly 1 welcome email outbox record exists');
  });

  // 4. Repeated verification requests do not create duplicate welcome emails
  await test('4. Repeated verification requests do not create duplicate welcome emails', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'repeat@welcome.example',
        name: 'Repeat Test',
      },
    });

    // Create and consume first code
    await tokensModule.createVerificationCodeRecord(user.id, '444555', mockPrisma);
    const res1 = await tokensModule.consumeVerificationCode('repeat@welcome.example', '444555', mockPrisma);
    assert(res1.welcomeOutboxId, 'First consumption created welcome email');

    // Create a new code after account is already verified
    await tokensModule.createVerificationCodeRecord(user.id, '666777', mockPrisma);
    const res2 = await tokensModule.consumeVerificationCode('repeat@welcome.example', '666777', mockPrisma);
    assert.strictEqual(res2.welcomeOutboxId, undefined, 'Subsequent consumption on verified user does NOT create another welcome outbox record');

    let welcomeCount = 0;
    for (const o of mockPrisma._store.emailOutbox.values()) {
      if (o.userId === user.id && o.tokenId === null) welcomeCount++;
    }
    assert.strictEqual(welcomeCount, 1, 'Strictly 1 welcome outbox record created');
  });

  // 5. The verification API does not wait for SMTP delivery (returns immediately)
  await test('5. The verification API does not wait for SMTP delivery', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);
    const dispatchedEvents = [];
    const mockInngest = {
      send: async (event) => {
        dispatchedEvents.push(event);
      },
    };

    const user = await mockPrisma.user.create({
      data: {
        email: 'async@welcome.example',
        name: 'Async Verification',
      },
    });
    await tokensModule.createVerificationCodeRecord(user.id, '555666', mockPrisma);

    const verifyRoute = loadTsModule('src/app/api/auth/verify-email/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngest },
      '@/lib/tokens': tokensModule,
    });

    const req = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'async@welcome.example', code: '555666' }),
    });

    const start = Date.now();
    const res = await verifyRoute.POST(req);
    const elapsed = Date.now() - start;

    assert.strictEqual(res.status, 200, 'HTTP 200 returned immediately');
    const body = await res.json();
    assert.strictEqual(body.success, true, 'Verification succeeds');
    assert(elapsed < 500, 'API returns quickly without waiting for SMTP');
    assert.strictEqual(dispatchedEvents.length, 1, 'Inngest event dispatched');
    assert.strictEqual(dispatchedEvents[0].name, 'auth/welcome.email.requested', 'Event name is auth/welcome.email.requested');
  });

  // 6. Inngest dispatch failure leaves a recoverable outbox record
  await test('6. Inngest dispatch failure leaves a recoverable outbox record', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);
    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest connection error');
      },
    };

    const user = await mockPrisma.user.create({
      data: {
        email: 'inngestfail@welcome.example',
        name: 'Inngest Fail',
      },
    });
    await tokensModule.createVerificationCodeRecord(user.id, '777888', mockPrisma);

    const verifyRoute = loadTsModule('src/app/api/auth/verify-email/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/lib/tokens': tokensModule,
    });

    const req = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'inngestfail@welcome.example', code: '777888' }),
    });

    const res = await verifyRoute.POST(req);
    assert.strictEqual(res.status, 200, 'Route returns HTTP 200 even if inngest.send throws');

    // Check outbox record remains PENDING for scheduled cron recovery
    let pendingWelcome = null;
    for (const o of mockPrisma._store.emailOutbox.values()) {
      if (o.userId === user.id && o.tokenId === null) pendingWelcome = o;
    }
    assert(pendingWelcome, 'Outbox record exists');
    assert.strictEqual(pendingWelcome.status, 'PENDING', 'Record remains PENDING for scheduled recovery');
  });

  // 7. Welcome email is delivered by the background worker
  await test('7. Welcome email is delivered by the background worker', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, welcomeJobModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'worker@welcome.example',
        name: 'Worker Test',
      },
    });

    const welcomeOutbox = await outboxModule.createWelcomeEmailOutboxRecord(
      {
        userId: user.id,
        toEmail: user.email,
        name: user.name,
      },
      mockPrisma
    );

    const deliveredEmails = [];
    const mockTransporter = {
      sendMail: async (mailOpts) => {
        deliveredEmails.push(mailOpts);
        return { messageId: 'msg-welcome-001' };
      },
    };

    const result = await welcomeJobModule.processOutboxWelcomeEmail(welcomeOutbox.id, {
      name: user.name,
      transporter: mockTransporter,
    });

    assert.strictEqual(result.status, 'SENT', 'Worker marks status SENT');
    assert.strictEqual(deliveredEmails.length, 1, 'Exactly 1 welcome email delivered');
    assert(deliveredEmails[0].subject.includes('Welcome to Good Pets'), 'Subject contains Welcome to Good Pets');
    assert(deliveredEmails[0].html.includes('Welcome to Good Pets!'), 'HTML contains branded greeting');

    const outboxAfter = await mockPrisma.emailOutbox.findUnique({ where: { id: welcomeOutbox.id } });
    assert.strictEqual(outboxAfter.status, 'SENT', 'Outbox record transitioned to SENT');
    assert(outboxAfter.sentAt, 'sentAt timestamp populated');
    assert.strictEqual(outboxAfter.encryptedPayload, null, 'Sensitive payload purged on completion');
  });

  // 8. Worker retries handle transient failures
  await test('8. Worker retries handle transient failures', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, welcomeJobModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'retry@welcome.example',
        name: 'Retry Test',
      },
    });

    const welcomeOutbox = await outboxModule.createWelcomeEmailOutboxRecord(
      {
        userId: user.id,
        toEmail: user.email,
        name: user.name,
      },
      mockPrisma
    );

    const mockFailingTransporter = {
      sendMail: async () => {
        const err = new Error('Connection timeout');
        err.code = 'ETIMEDOUT';
        throw err;
      },
    };

    const result = await welcomeJobModule.processOutboxWelcomeEmail(welcomeOutbox.id, {
      transporter: mockFailingTransporter,
    });

    assert.strictEqual(result.status, 'FAILED', 'Worker marks FAILED on error');
    assert.strictEqual(result.retryable, true, 'Retryable error classified');

    const outboxAfter = await mockPrisma.emailOutbox.findUnique({ where: { id: welcomeOutbox.id } });
    assert.strictEqual(outboxAfter.status, 'FAILED', 'Status updated to FAILED in DB');
    assert.strictEqual(outboxAfter.attempts, 1, 'Attempts incremented to 1');
    assert(outboxAfter.scheduledAt > new Date(), 'Future backoff scheduled');
  });

  // 9. Already-SENT welcome emails are not delivered again
  await test('9. Already-SENT welcome emails are not delivered again', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, welcomeJobModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'alreadysent@welcome.example',
        name: 'Already Sent',
      },
    });

    const welcomeOutbox = await outboxModule.createWelcomeEmailOutboxRecord(
      {
        userId: user.id,
        toEmail: user.email,
        name: user.name,
      },
      mockPrisma
    );

    // Set to SENT
    await mockPrisma.emailOutbox.update({
      where: { id: welcomeOutbox.id },
      data: { status: 'SENT', sentAt: new Date(), encryptedPayload: null },
    });

    const sentEmails = [];
    const mockTransporter = {
      sendMail: async (opts) => {
        sentEmails.push(opts);
        return { messageId: 'msg-dupe' };
      },
    };

    const result = await welcomeJobModule.processOutboxWelcomeEmail(welcomeOutbox.id, {
      transporter: mockTransporter,
    });

    assert.strictEqual(result.status, 'SKIPPED', 'Worker skips already SENT record');
    assert.strictEqual(result.reason, 'ALREADY_SENT', 'Reason is ALREADY_SENT');
    assert.strictEqual(sentEmails.length, 0, 'No email sent');
  });

  // 10. Existing verification email functionality remains unaffected
  await test('10. Existing verification email functionality remains unaffected', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, tokensModule, verifJobModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'unaffected@goodpets.example',
        name: 'Grace Hopper',
      },
    });

    const code = '987654';
    const token = await tokensModule.createVerificationCodeRecord(user.id, code, mockPrisma);
    const outbox = await outboxModule.createEmailOutboxRecord(
      {
        userId: user.id,
        tokenId: token.id,
        toEmail: user.email,
        rawCode: code,
      },
      mockPrisma
    );

    assert(outbox.tokenId, 'Verification outbox preserves non-null tokenId');

    const sentEmails = [];
    const mockTransporter = {
      sendMail: async (opts) => {
        sentEmails.push(opts);
        return { messageId: 'msg-verif-001' };
      },
    };

    const result = await verifJobModule.processOutboxVerificationEmail(outbox.id, {
      name: user.name,
      transporter: mockTransporter,
    });

    assert.strictEqual(result.status, 'SENT', 'Verification delivery succeeds');
    assert.strictEqual(sentEmails.length, 1, 'Verification email sent');
    assert(sentEmails[0].subject.includes('Your Good Pets Verification Code'), 'Verification email content preserved');
    assert(sentEmails[0].html.includes('987654'), 'Verification code present in email');
  });

  console.log(`\nResults: ${passed}/${total} Stage 7.4 welcome email tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
