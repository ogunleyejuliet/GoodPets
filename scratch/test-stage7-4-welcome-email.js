/**
 * GoodPets Task 4 Step 10: Stage 7.4 — Welcome Email Background Job & Fallback Test Suite
 *
 * Requirements Tested:
 * 1. Successful verification creates a welcome email outbox record.
 * 2. Failed verification does not create a welcome email.
 * 3. Reusing a verification code does not create another welcome email.
 * 4. Repeated verification requests do not create duplicate welcome emails.
 * 5. Successful Inngest dispatch does not invoke direct fallback.
 * 6. Failed Inngest dispatch invokes direct fallback exactly once.
 * 7. Successful fallback processes the welcome email (status -> SENT, sentAt set, payload purged).
 * 8. Failed fallback does not undo email verification (User.emailVerified remains set, HTTP 200 returned).
 * 9. Existing SENT records are not resent (ALREADY_SENT).
 * 10. Concurrent processing respects atomic outbox claiming (CAS row locking).
 * 11. Existing verification email functionality remains unaffected.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== Stage 7.4: Welcome Email Background Job & Fallback Suite ===\n');

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
  await test('1. Successful verification creates a welcome email outbox record with existing customerId', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, tokensModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'ada@welcome.example',
        name: 'Ada Lovelace',
        customerId: '5474',
      },
    });

    const code = '123456';
    await tokensModule.createVerificationCodeRecord(user.id, code, mockPrisma);

    const result = await tokensModule.consumeVerificationCode('ada@welcome.example', code, mockPrisma);

    assert(result.welcomeOutboxId, 'welcomeOutboxId must be returned on successful verification');
    assert.strictEqual(result.customerId, '5474', 'result.customerId matches existing user.customerId');
    const outboxRecord = await mockPrisma.emailOutbox.findUnique({ where: { id: result.welcomeOutboxId } });
    assert.strictEqual(outboxRecord.userId, user.id, 'Outbox user ID matches');
    assert.strictEqual(outboxRecord.toEmail, 'ada@welcome.example', 'Outbox toEmail matches');
    assert.strictEqual(outboxRecord.tokenId, null, 'tokenId is strictly null for welcome emails');
    assert.strictEqual(outboxRecord.status, 'PENDING', 'Initial outbox status is PENDING');
    assert(outboxRecord.encryptedPayload, 'Encrypted payload is stored');

    // Decrypt and verify customerId is in the payload
    const decryptedJson = outboxModule.decryptTokenPayload(outboxRecord.encryptedPayload);
    const parsedPayload = JSON.parse(decryptedJson);
    assert.strictEqual(parsedPayload.type, 'WELCOME', 'Payload type is WELCOME');
    assert.strictEqual(parsedPayload.customerId, '5474', 'Customer ID is preserved in encrypted payload');
    assert.strictEqual(parsedPayload.name, 'Ada Lovelace', 'Customer name is in encrypted payload');
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

    const firstResult = await tokensModule.consumeVerificationCode('reuse@welcome.example', code, mockPrisma);
    assert(firstResult.welcomeOutboxId, 'First consumption creates welcome outbox');

    let reusedThrown = false;
    try {
      await tokensModule.consumeVerificationCode('reuse@welcome.example', code, mockPrisma);
    } catch (err) {
      if (err.name === 'TokenReusedError') reusedThrown = true;
    }

    assert(reusedThrown, 'Reusing code throws TokenReusedError');
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

    await tokensModule.createVerificationCodeRecord(user.id, '444555', mockPrisma);
    const res1 = await tokensModule.consumeVerificationCode('repeat@welcome.example', '444555', mockPrisma);
    assert(res1.welcomeOutboxId, 'First consumption created welcome email');

    await tokensModule.createVerificationCodeRecord(user.id, '666777', mockPrisma);
    const res2 = await tokensModule.consumeVerificationCode('repeat@welcome.example', '666777', mockPrisma);
    assert.strictEqual(res2.welcomeOutboxId, undefined, 'Subsequent consumption on verified user does NOT create another welcome outbox record');

    let welcomeCount = 0;
    for (const o of mockPrisma._store.emailOutbox.values()) {
      if (o.userId === user.id && o.tokenId === null) welcomeCount++;
    }
    assert.strictEqual(welcomeCount, 1, 'Strictly 1 welcome outbox record created');
  });

  // 5. Successful Inngest dispatch does not invoke direct fallback
  await test('5. Successful Inngest dispatch does not invoke direct fallback', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);
    const dispatchedEvents = [];
    let fallbackCalls = 0;

    const mockInngest = {
      send: async (event) => {
        dispatchedEvents.push(event);
      },
    };

    const mockSendWelcomeModule = {
      processOutboxWelcomeEmail: async () => {
        fallbackCalls++;
        return { success: true, status: 'SENT' };
      },
    };

    const user = await mockPrisma.user.create({
      data: {
        email: 'success-dispatch@welcome.example',
        name: 'Success Dispatch',
      },
    });
    await tokensModule.createVerificationCodeRecord(user.id, '555666', mockPrisma);

    const verifyRoute = loadTsModule('src/app/api/auth/verify-email/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngest },
      '@/lib/tokens': tokensModule,
      '@/inngest/functions/send-welcome-email': mockSendWelcomeModule,
    });

    const req = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'success-dispatch@welcome.example', code: '555666' }),
    });

    const res = await verifyRoute.POST(req);
    assert.strictEqual(res.status, 200, 'HTTP 200 returned');
    assert.strictEqual(dispatchedEvents.length, 1, 'Inngest event dispatched');
    assert.strictEqual(dispatchedEvents[0].name, 'auth/welcome.email.requested', 'Event name match');
    assert.strictEqual(fallbackCalls, 0, 'Direct fallback must NOT be called when inngest.send succeeds');
  });

  // 6. Failed Inngest dispatch invokes direct fallback exactly once
  await test('6. Failed Inngest dispatch invokes direct fallback exactly once', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);
    let fallbackCalls = 0;
    let fallbackOutboxId = null;

    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest connection error');
      },
    };

    const mockSendWelcomeModule = {
      processOutboxWelcomeEmail: async (outboxId) => {
        fallbackCalls++;
        fallbackOutboxId = outboxId;
        return { success: true, status: 'SENT' };
      },
    };

    const user = await mockPrisma.user.create({
      data: {
        email: 'fallback-invoke@welcome.example',
        name: 'Fallback Invoke',
      },
    });
    await tokensModule.createVerificationCodeRecord(user.id, '777888', mockPrisma);

    const verifyRoute = loadTsModule('src/app/api/auth/verify-email/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/lib/tokens': tokensModule,
      '@/inngest/functions/send-welcome-email': mockSendWelcomeModule,
    });

    const req = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'fallback-invoke@welcome.example', code: '777888' }),
    });

    const res = await verifyRoute.POST(req);
    assert.strictEqual(res.status, 200, 'Route returns HTTP 200 on fallback');
    assert.strictEqual(fallbackCalls, 1, 'Fallback processOutboxWelcomeEmail must be invoked exactly once');
    assert(fallbackOutboxId, 'Fallback received valid outbox ID');
  });

  // 7. Successful fallback processes the welcome email (status -> SENT, sentAt set, payload purged)
  await test('7. Successful fallback processes the welcome email', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, tokensModule } = getModules(mockPrisma);

    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest unavailable');
      },
    };

    const mockEmailModule = {
      sendWelcomeEmailFromPayload: async () => ({ success: true, messageId: 'msg-welcome-fallback' }),
    };

    const welcomeJobWithMockEmail = loadTsModule('src/inngest/functions/send-welcome-email.ts', {
      '@/lib/prisma': mockPrisma,
      '@/lib/outbox': outboxModule,
      '@/lib/email': mockEmailModule,
    });

    const user = await mockPrisma.user.create({
      data: {
        email: 'fallback-process@welcome.example',
        name: 'Grace Hopper',
      },
    });
    await tokensModule.createVerificationCodeRecord(user.id, '123987', mockPrisma);

    const verifyRoute = loadTsModule('src/app/api/auth/verify-email/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/lib/tokens': tokensModule,
      '@/inngest/functions/send-welcome-email': welcomeJobWithMockEmail,
    });

    const req = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'fallback-process@welcome.example', code: '123987' }),
    });

    const res = await verifyRoute.POST(req);
    assert.strictEqual(res.status, 200, 'HTTP 200 returned');

    let welcomeOutbox = null;
    for (const o of mockPrisma._store.emailOutbox.values()) {
      if (o.userId === user.id && o.tokenId === null) welcomeOutbox = o;
    }

    assert(welcomeOutbox, 'Welcome outbox record must exist');
    assert.strictEqual(welcomeOutbox.status, 'SENT', 'Fallback must transition status to SENT');
    assert(welcomeOutbox.sentAt, 'sentAt timestamp must be set');
    assert.strictEqual(welcomeOutbox.encryptedPayload, null, 'Encrypted payload must be purged');
  });

  // 8. Failed fallback does not undo email verification
  await test('8. Failed fallback does not undo email verification', async () => {
    const mockPrisma = createMockPrisma();
    const { tokensModule } = getModules(mockPrisma);

    const mockInngestFailing = {
      send: async () => {
        throw new Error('Inngest offline');
      },
    };

    const mockFailingWelcomeJob = {
      processOutboxWelcomeEmail: async () => {
        throw new Error('SMTP connection timed out during fallback');
      },
    };

    const user = await mockPrisma.user.create({
      data: {
        email: 'smtp-fail@welcome.example',
        name: 'SMTP Fail',
      },
    });
    await tokensModule.createVerificationCodeRecord(user.id, '234567', mockPrisma);

    const verifyRoute = loadTsModule('src/app/api/auth/verify-email/route.ts', {
      '@/lib/prisma': mockPrisma,
      '@/inngest/client': { inngest: mockInngestFailing },
      '@/lib/tokens': tokensModule,
      '@/inngest/functions/send-welcome-email': mockFailingWelcomeJob,
    });

    const req = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'smtp-fail@welcome.example', code: '234567' }),
    });

    const res = await verifyRoute.POST(req);
    assert.strictEqual(res.status, 200, 'Route must still return HTTP 200 when fallback email fails');
    const body = await res.json();
    assert.strictEqual(body.success, true, 'Verification success reported to user');

    const updatedUser = await mockPrisma.user.findUnique({ where: { id: user.id } });
    assert(updatedUser.emailVerified, 'User must remain verified in DB even when welcome email fails');
  });

  // 9. Existing SENT records are not resent (ALREADY_SENT)
  await test('9. Existing SENT records are not resent', async () => {
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

    // Mark as SENT
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
    assert.strictEqual(sentEmails.length, 0, 'No duplicate email sent');
  });

  // 10. Concurrent processing respects atomic outbox claiming
  await test('10. Concurrent processing respects atomic outbox claiming', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule } = getModules(mockPrisma);

    const user = await mockPrisma.user.create({
      data: {
        email: 'concurrent@welcome.example',
        name: 'Concurrent Test',
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

    // Simulate two concurrent workers claiming the same outbox record simultaneously
    const [claim1, claim2] = await Promise.all([
      outboxModule.claimOutboxRecordForProcessing(welcomeOutbox.id, mockPrisma),
      outboxModule.claimOutboxRecordForProcessing(welcomeOutbox.id, mockPrisma),
    ]);

    const claims = [claim1, claim2].filter(Boolean);
    assert.strictEqual(claims.length, 1, 'CAS atomic update guarantees exactly 1 worker claims the record');
  });

  // 11. Existing verification email functionality remains unaffected
  await test('11. Existing verification email functionality remains unaffected', async () => {
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

  // 12. Welcome email template renders customerId and required explanation prominently
  await test('12. Welcome email template renders customerId and required explanation prominently', async () => {
    const mockPrisma = createMockPrisma();
    const { emailModule } = getModules(mockPrisma);

    const content = emailModule.buildWelcomeEmailContent({
      recipientEmail: 'customer@goodpets.example',
      name: 'Ada Lovelace',
      customerId: '5474',
    });

    const explanation = 'Your Customer ID is required when signing in to your GoodPets account. Keep it somewhere safe.';

    assert(content.html.includes('5474'), 'HTML includes customerId');
    assert(content.html.includes(explanation), 'HTML includes exact customer ID explanation');
    assert(content.text.includes('CUSTOMER ID: 5474'), 'Text includes customerId');
    assert(content.text.includes(explanation), 'Text includes exact customer ID explanation');

    // Without customerId (graceful degradation)
    const contentWithoutId = emailModule.buildWelcomeEmailContent({
      recipientEmail: 'customer@goodpets.example',
      name: 'Ada Lovelace',
    });
    assert(!contentWithoutId.html.includes(explanation), 'HTML omits explanation when customerId is absent');
  });

  // 13. End-to-end welcome email worker decrypts payload and delivers customerId
  await test('13. Welcome email worker decrypts payload and delivers customerId to recipient', async () => {
    const mockPrisma = createMockPrisma();
    const { outboxModule, welcomeJobModule } = getModules(mockPrisma);

    const encryptedPayload = outboxModule.encryptTokenPayload(
      JSON.stringify({
        type: 'WELCOME',
        name: 'Alan Turing',
        customerId: '8899',
      })
    );

    const record = await mockPrisma.emailOutbox.create({
      data: {
        userId: 'usr-alan',
        toEmail: 'alan@enigma.example',
        tokenId: null,
        encryptedPayload,
        status: 'PENDING',
        attempts: 0,
      },
    });

    const deliveredEmails = [];
    const mockTransporter = {
      sendMail: async (opts) => {
        deliveredEmails.push(opts);
        return { messageId: 'msg-welcome-alan' };
      },
    };

    const result = await welcomeJobModule.processOutboxWelcomeEmail(record.id, {
      transporter: mockTransporter,
    });

    assert.strictEqual(result.status, 'SENT', 'Worker marks outbox as SENT');
    assert.strictEqual(deliveredEmails.length, 1, 'Exactly one email sent');
    assert(deliveredEmails[0].html.includes('8899'), 'Delivered HTML contains customer ID decrypted from payload');
    assert(
      deliveredEmails[0].html.includes('Your Customer ID is required when signing in to your GoodPets account. Keep it somewhere safe.'),
      'Delivered HTML contains customer ID explanation'
    );
    assert(deliveredEmails[0].text.includes('CUSTOMER ID: 8899'), 'Delivered text contains customer ID decrypted from payload');
  });

  // 14. Verification email never exposes customerId
  await test('14. Verification email never exposes customerId', async () => {
    const mockPrisma = createMockPrisma();
    const { emailModule } = getModules(mockPrisma);

    const verifContent = emailModule.buildVerificationEmailContent({
      code: '654321',
      recipientEmail: 'user@example.com',
      name: 'Ada Lovelace',
    });

    assert(!verifContent.html.includes('Customer ID'), 'Verification email HTML does not mention Customer ID');
    assert(!verifContent.text.includes('Customer ID'), 'Verification email text does not mention Customer ID');
  });

  console.log(`\nResults: ${passed}/${total} Stage 7.4 welcome email & fallback tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
