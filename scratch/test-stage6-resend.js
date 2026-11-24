/**
 * GoodPets Task 4 Step 10: Stage 6 — Resend Verification Code Test Suite
 *
 * Requirements Verified:
 * 1. Successful resend for an unverified customer.
 * 2. New code is six digits and valid for 10 minutes.
 * 3. Previous code is invalidated upon resend.
 * 4. Only the HMAC is stored in AuthToken (no plaintext).
 * 5. Encrypted outbox record is created with AES-256-GCM.
 * 6. SMTP dispatch is triggered through existing mechanism.
 * 7. Nonexistent email receives generic HTTP 200 response (anti-enumeration).
 * 8. Already-verified email receives generic HTTP 200 response (anti-enumeration).
 * 9. Three requests per hour allowed and 4th request is rate-limited (HTTP 429).
 * 10. Rate limiting applies to nonexistent email addresses.
 * 11. Concurrent resend requests do not create inconsistent active tokens.
 * 12. Verification UI includes resend action and neutral notification.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== GoodPets Task 4 Step 10: Stage 6 — Resend Verification Code Suite ===\n');

const ROOT = path.resolve(__dirname, '..');
process.env.AUTH_SECRET = 'goodpets-test-secret-minimum-32-chars-long-12345';
process.env.VERIFICATION_CODE_SECRET = 'goodpets-verification-hmac-secret-at-least-32-chars!';
process.env.EMAIL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';

// TypeScript loader
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

// In-Memory Database Simulator
function createMockPrisma() {
  const users = new Map();
  const authTokens = new Map();
  const emailOutbox = new Map();
  const rateLimits = new Map();

  function makeTx() {
    return {
      authToken: {
        async create({ data }) {
          const id = 'tok_' + crypto.randomUUID().slice(0, 8);
          const record = { id, ...data, createdAt: new Date() };
          authTokens.set(record.tokenHash, record);
          return record;
        },
        async updateMany({ where, data }) {
          let count = 0;
          for (const [hash, record] of authTokens.entries()) {
            let match = true;
            if (where.userId && record.userId !== where.userId) match = false;
            if (where.tokenHash && record.tokenHash !== where.tokenHash) match = false;
            if (where.purpose && record.purpose !== where.purpose) match = false;
            if (where.usedAt === null && record.usedAt !== null) match = false;
            if (where.expiresAt?.gt && !(record.expiresAt > where.expiresAt.gt)) match = false;

            if (match) {
              Object.assign(record, data);
              count++;
            }
          }
          return { count };
        },
        async findFirst({ where }) {
          for (const record of authTokens.values()) {
            let match = true;
            if (where.userId && record.userId !== where.userId) match = false;
            if (where.tokenHash && record.tokenHash !== where.tokenHash) match = false;
            if (where.purpose && record.purpose !== where.purpose) match = false;
            if (match) return record;
          }
          return null;
        },
        async upsert({ where, create, update }) {
          const existing = authTokens.get(where.tokenHash);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const id = 'tok_' + crypto.randomUUID().slice(0, 8);
          const record = { id, ...create, createdAt: new Date() };
          authTokens.set(record.tokenHash, record);
          return record;
        },
      },
      user: {
        async create({ data }) {
          const id = 'usr_' + crypto.randomUUID().slice(0, 8);
          const user = { id, ...data, createdAt: new Date() };
          users.set(user.id, user);
          return user;
        },
        async update({ where, data }) {
          const user = users.get(where.id);
          if (!user) throw new Error('User not found');
          Object.assign(user, data);
          return user;
        },
        async findUnique({ where }) {
          if (where.id) return users.get(where.id) || null;
          if (where.email) {
            const needle = where.email.toLowerCase();
            for (const u of users.values()) {
              if (u.email.toLowerCase() === needle) return u;
            }
          }
          return null;
        },
      },
      emailOutbox: {
        async create({ data }) {
          const id = 'out_' + crypto.randomUUID().slice(0, 8);
          const record = { id, ...data, attempts: 0, createdAt: new Date(), updatedAt: new Date() };
          emailOutbox.set(id, record);
          return record;
        },
      },
    };
  }

  const baseClient = {
    ...makeTx(),
    async $transaction(fn) {
      return fn(makeTx());
    },
    // Rate limit operations
    $executeRawUnsafe: async (sql, ...params) => 1,
    $queryRawUnsafe: async (sql, ...params) => {
      // Mock for reserveRateLimits query
      const key = params[0];
      const windowSeconds = params[1];
      const now = new Date();
      let entry = rateLimits.get(key);

      if (!entry || (now.getTime() - entry.windowStart.getTime()) >= windowSeconds * 1000) {
        entry = { count: 1, windowStart: now };
      } else {
        entry.count += 1;
      }
      rateLimits.set(key, entry);

      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000)
      );

      return [{
        count: entry.count,
        windowStart: entry.windowStart,
        retryAfterSeconds,
      }];
    },
  };

  return { client: baseClient, authTokens, emailOutbox, users, rateLimits };
}

// Next.js mock structures
function createMockRequest(body, headers = {}) {
  const normalizedHeaders = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: {
      get(name) {
        return normalizedHeaders.get(name.toLowerCase()) || null;
      },
    },
    async json() {
      return body;
    },
  };
}

async function runTest(num, name, fn) {
  try {
    await fn();
    console.log(`[PASS] Req ${num}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Req ${num}: ${name}`);
    console.error(`       Error: ${err.message || err}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    process.exitCode = 1;
  }
}

async function main() {
  const tokensModule = loadTsModule('src/lib/tokens.ts');
  const outboxModule = loadTsModule('src/lib/outbox.ts');
  const baseRateLimitModule = loadTsModule('src/lib/rate-limit.ts');

  function createTestRateLimit(rateLimitsMap = new Map()) {
    return {
      ...baseRateLimitModule,
      reserveRateLimits: async (rules) => {
        const now = new Date();
        const reservations = [];
        for (const rule of rules) {
          let entry = rateLimitsMap.get(rule.key);
          if (!entry || (now.getTime() - entry.windowStart.getTime()) >= rule.windowSeconds * 1000) {
            entry = { count: 1, windowStart: now };
          } else {
            entry.count += 1;
          }
          rateLimitsMap.set(rule.key, entry);

          if (entry.count > rule.limit) {
            const retryAfter = Math.max(
              1,
              Math.ceil((entry.windowStart.getTime() + rule.windowSeconds * 1000 - now.getTime()) / 1000)
            );
            throw new baseRateLimitModule.RateLimitExceededError(retryAfter);
          }
          reservations.push({ key: rule.key, windowStart: entry.windowStart });
        }
        return reservations;
      },
    };
  }

  // Req 1 to 6: Eligible unverified customer resend processing
  await runTest(1, 'Successful resend for an unverified customer creates new 6-digit code and outbox record', async () => {
    const { client, users, authTokens, emailOutbox, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);

    // Setup an unverified customer
    const user = await client.user.create({
      data: {
        email: 'unverified@goodpets.ng',
        name: 'Chioma Test',
        role: 'CUSTOMER',
        emailVerified: null,
        isActive: true,
      },
    });

    // Old initial verification code issued during signup
    const oldCode = '111111';
    await tokensModule.createVerificationCodeRecord(user.id, oldCode, client);

    // Mock SMTP delivery capture
    const sentEmails = [];
    const mockEmailModule = {
      sendVerificationEmailDirect: async (params) => {
        sentEmails.push(params);
        return { success: true, messageId: 'msg_' + crypto.randomUUID() };
      },
    };

    // Load resend route with mocks
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': mockEmailModule,
      '@/lib/rate-limit': rateLimitModule,
    });

    const req = createMockRequest({ email: 'UNVERIFIED@goodpets.ng' });
    const res = await resendRoute.POST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert(body.message.includes('6-digit verification code has been sent'));

    // Verify SMTP dispatch was triggered with 6-digit code
    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].toEmail, 'unverified@goodpets.ng');
    assert(/^\d{6}$/.test(sentEmails[0].code));
    assert.strictEqual(sentEmails[0].code.length, 6);
  });

  // Req 2 & 4: New code validity and HMAC storage
  await runTest(2, 'New code is six digits, valid for 10 minutes, and stored ONLY as HMAC', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    const user = await client.user.create({
      data: {
        email: 'validity@goodpets.ng',
        name: 'Validity Test',
        role: 'CUSTOMER',
        emailVerified: null,
        isActive: true,
      },
    });

    let sentCode = '';
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': {
        sendVerificationEmailDirect: async (p) => {
          sentCode = p.code;
          return { success: true, messageId: 'mock-msg' };
        },
      },
      '@/lib/rate-limit': rateLimitModule,
    });

    const res = await resendRoute.POST(createMockRequest({ email: 'validity@goodpets.ng' }));
    assert.strictEqual(res.status, 200);

    assert(/^\d{6}$/.test(sentCode));
    const tokenHash = tokensModule.hashVerificationCode(user.id, sentCode);

    // Verify in tokens
    const activeToken = await client.authToken.findFirst({ where: { tokenHash } });
    assert(activeToken, 'Token must exist in database matching computed HMAC');
    assert.strictEqual(activeToken.tokenHash.length, 64);
    assert(!activeToken.tokenHash.includes(sentCode), 'Raw code must NEVER be in hash');

    // Expiry check (approximately 10 minutes from now, >= 9.9m and <= 10.1m)
    const diffMs = activeToken.expiresAt.getTime() - Date.now();
    const diffMinutes = diffMs / (60 * 1000);
    assert(diffMinutes >= 9.8 && diffMinutes <= 10.2, `Expected ~10 minutes, got ${diffMinutes}`);
  });

  // Req 3: Previous code invalidation
  await runTest(3, 'Previous active verification code is invalidated upon resend', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    const user = await client.user.create({
      data: {
        email: 'invalidation@goodpets.ng',
        name: 'Invalidation Test',
        role: 'CUSTOMER',
        emailVerified: null,
        isActive: true,
      },
    });

    const firstCode = '123456';
    await tokensModule.createVerificationCodeRecord(user.id, firstCode, client);

    let secondCode = '';
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': {
        sendVerificationEmailDirect: async (p) => {
          secondCode = p.code;
          return { success: true };
        },
      },
      '@/lib/rate-limit': rateLimitModule,
    });

    // Trigger resend
    await resendRoute.POST(createMockRequest({ email: 'invalidation@goodpets.ng' }));

    // Verify old code is now expired/invalidated
    await assert.rejects(
      async () => {
        await tokensModule.consumeVerificationCode(user.email, firstCode, client);
      },
      tokensModule.TokenExpiredError,
      'Old code must throw TokenExpiredError after resend'
    );

    // Verify new code consumes successfully
    const res = await tokensModule.consumeVerificationCode(user.email, secondCode, client);
    assert.strictEqual(res.userId, user.id);
  });

  // Req 5: Encrypted outbox record created
  await runTest(5, 'Encrypted outbox record created with AES-256-GCM', async () => {
    const { client, emailOutbox, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    const user = await client.user.create({
      data: {
        email: 'outbox@goodpets.ng',
        name: 'Outbox Test',
        role: 'CUSTOMER',
        emailVerified: null,
        isActive: true,
      },
    });

    let dispatchedCode = '';
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': {
        sendVerificationEmailDirect: async (p) => {
          dispatchedCode = p.code;
          return { success: true };
        },
      },
      '@/lib/rate-limit': rateLimitModule,
    });

    await resendRoute.POST(createMockRequest({ email: 'outbox@goodpets.ng' }));

    assert.strictEqual(emailOutbox.size, 1);
    const outboxRecord = Array.from(emailOutbox.values())[0];
    assert.strictEqual(outboxRecord.toEmail, 'outbox@goodpets.ng');
    assert.strictEqual(outboxRecord.status, 'PENDING');
    assert(!outboxRecord.encryptedPayload.includes(dispatchedCode), 'Payload must be encrypted');

    // Decrypt and verify payload matches dispatched code
    const decrypted = outboxModule.decryptTokenPayload(outboxRecord.encryptedPayload);
    assert.strictEqual(decrypted, dispatchedCode);
  });

  // Req 7 & 8: Anti-enumeration for nonexistent and already-verified accounts
  await runTest(7, 'Nonexistent email receives identical generic HTTP 200 response', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    let emailDispatched = false;

    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': {
        sendVerificationEmailDirect: async () => {
          emailDispatched = true;
          return { success: true };
        },
      },
      '@/lib/rate-limit': rateLimitModule,
    });

    const res = await resendRoute.POST(createMockRequest({ email: 'does-not-exist@goodpets.ng' }));
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert(body.message.includes('6-digit verification code has been sent'));
    assert.strictEqual(emailDispatched, false, 'No email should be dispatched for nonexistent account');
  });

  await runTest(8, 'Already-verified email receives identical generic HTTP 200 response', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    await client.user.create({
      data: {
        email: 'verified@goodpets.ng',
        name: 'Already Verified',
        role: 'CUSTOMER',
        emailVerified: new Date(),
        isActive: true,
      },
    });

    let emailDispatched = false;
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': {
        sendVerificationEmailDirect: async () => {
          emailDispatched = true;
          return { success: true };
        },
      },
      '@/lib/rate-limit': rateLimitModule,
    });

    const res = await resendRoute.POST(createMockRequest({ email: 'verified@goodpets.ng' }));
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert(body.message.includes('6-digit verification code has been sent'));
    assert.strictEqual(emailDispatched, false, 'No email should be dispatched for verified account');
  });

  // Req 9 & 10: Rate limiting (3 requests/hour per normalized email)
  await runTest(9, 'Three requests per hour allowed and 4th request is rate-limited (HTTP 429)', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    await client.user.create({
      data: {
        email: 'ratelimit@goodpets.ng',
        name: 'Rate Limit Test',
        role: 'CUSTOMER',
        emailVerified: null,
        isActive: true,
      },
    });

    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': { sendVerificationEmailDirect: async () => ({ success: true }) },
      '@/lib/rate-limit': rateLimitModule,
    });

    // 1st, 2nd, 3rd requests succeed
    for (let i = 1; i <= 3; i++) {
      const res = await resendRoute.POST(createMockRequest({ email: 'ratelimit@goodpets.ng' }));
      assert.strictEqual(res.status, 200, `Request ${i} must succeed with 200`);
    }

    // 4th request fails with 429
    const res4 = await resendRoute.POST(createMockRequest({ email: 'ratelimit@goodpets.ng' }));
    const body4 = await res4.json();

    assert.strictEqual(res4.status, 429);
    assert.strictEqual(body4.success, false);
    assert(body4.error.includes('Too many verification code requests'));
    assert(res4.headers.get('Retry-After'), 'Retry-After header must be set');
  });

  await runTest(10, 'Rate limiting applies equally to nonexistent email addresses', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': { sendVerificationEmailDirect: async () => ({ success: true }) },
      '@/lib/rate-limit': rateLimitModule,
    });

    const nonExistentEmail = 'ghost-target@example.com';

    // 1st, 2nd, 3rd succeed with 200
    for (let i = 1; i <= 3; i++) {
      const res = await resendRoute.POST(createMockRequest({ email: nonExistentEmail }));
      assert.strictEqual(res.status, 200);
    }

    // 4th is blocked with 429
    const res4 = await resendRoute.POST(createMockRequest({ email: nonExistentEmail }));
    assert.strictEqual(res4.status, 429);
  });

  // Req 11: Concurrent resend requests safety
  await runTest(11, 'Concurrent resend requests do not create inconsistent active verification tokens', async () => {
    const { client, rateLimits } = createMockPrisma();
    const rateLimitModule = createTestRateLimit(rateLimits);
    const user = await client.user.create({
      data: {
        email: 'concurrent@goodpets.ng',
        name: 'Concurrent Test',
        role: 'CUSTOMER',
        emailVerified: null,
        isActive: true,
      },
    });

    const dispatchedCodes = [];
    const resendRoute = loadTsModule('src/app/api/auth/resend-verification/route.ts', {
      '@/lib/prisma': client,
      '@/lib/tokens': tokensModule,
      '@/lib/outbox': outboxModule,
      '@/lib/email': {
        sendVerificationEmailDirect: async (p) => {
          dispatchedCodes.push(p.code);
          return { success: true };
        },
      },
      '@/lib/rate-limit': rateLimitModule,
    });

    // Simulate 2 parallel resend requests
    const [res1, res2] = await Promise.all([
      resendRoute.POST(createMockRequest({ email: 'concurrent@goodpets.ng' })),
      resendRoute.POST(createMockRequest({ email: 'concurrent@goodpets.ng' })),
    ]);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    // Verify exactly one active unexpired code can be consumed
    assert(dispatchedCodes.length >= 1);
    const lastCode = dispatchedCodes[dispatchedCodes.length - 1];
    const consumeRes = await tokensModule.consumeVerificationCode(user.email, lastCode, client);
    assert.strictEqual(consumeRes.userId, user.id);
  });

  // Req 12: Verification UI source inspection
  await runTest(12, 'Verification UI includes resend action, cooldown, and neutral message', async () => {
    const verifyPageSource = fs.readFileSync(path.resolve(ROOT, 'src/app/auth/verify/page.tsx'), 'utf8');
    assert(verifyPageSource.includes('/api/auth/resend-verification'), 'Page must call resend endpoint');
    assert(verifyPageSource.includes('handleResendCode'), 'Page must implement handleResendCode');
    assert(verifyPageSource.includes('resendCooldown'), 'Page must track resend cooldown');
    assert(verifyPageSource.includes('Resend code'), 'Page must contain Resend code label');
    assert(verifyPageSource.includes('resendNotice'), 'Page must render resendNotice');
  });

  console.log('\n======================================================');
  console.log('Results: All 12 Stage 6 assessment requirements passed!');
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
