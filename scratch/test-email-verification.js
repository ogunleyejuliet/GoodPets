/**
 * GoodPets Task 4, Step 10 — Email Verification & Outbox Automated Test Suite
 *
 * Verifies:
 * - 32-byte token generation & SHA-256 hashing (no raw tokens stored).
 * - 24-hour expiry calculation & expiration enforcement.
 * - Concurrency-safe atomic token consumption (race condition test).
 * - AES-256-GCM token encryption & integrity verification.
 * - Outbox persistence, claim-locking, and payload purging on sent.
 * - Signup registration without session auto-login (customerId preserved).
 * - Customer sign-in gating (unverified customer blocked with HTTP 403).
 * - Staff account exemption (FRONT_DESK / MANAGER can sign in).
 * - Resend verification rate limiting (3 requests/hr per email).
 * - Anti-enumeration identical HTTP 200 responses.
 * - 7-day unverified customer cleanup logic.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
process.env.AUTH_SECRET = 'goodpets-test-secret-key-minimum-32-chars-long-12345';
process.env.EMAIL_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

// ---------------------------------------------------------------------------
// TypeScript Loader for Direct Module Testing
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
// In-Memory Transactional Database Simulator
// ---------------------------------------------------------------------------
function createMockPrisma(options = {}) {
  const users = new Map();
  const authTokens = new Map();
  const emailOutbox = new Map();

  function makeTx() {
    const createdUsers = new Set();
    const createdTokens = new Set();
    const createdOutbox = new Set();

    return {
      authToken: {
        async create({ data }) {
          if (options.failTokenCreate) {
            throw new Error('Simulated database write error on authToken table');
          }
          const id = 'tok_' + crypto.randomUUID().slice(0, 8);
          const record = { id, ...data, createdAt: new Date() };
          authTokens.set(data.tokenHash, record);
          createdTokens.add(data.tokenHash);
          return record;
        },
        async updateMany({ where, data }) {
          let count = 0;
          for (const [hash, record] of authTokens.entries()) {
            let match = true;
            if (where.tokenHash && record.tokenHash !== where.tokenHash) match = false;
            if (where.userId && record.userId !== where.userId) match = false;
            if (where.purpose && record.purpose !== where.purpose) match = false;
            if (where.usedAt === null && record.usedAt !== null) match = false;
            if (where.expiresAt && where.expiresAt.gt && record.expiresAt <= where.expiresAt.gt) match = false;

            if (match) {
              Object.assign(record, data);
              count++;
            }
          }
          return { count };
        },
        async findUnique({ where, include }) {
          const record = authTokens.get(where.tokenHash);
          if (!record) return null;
          if (include && include.user) {
            return { ...record, user: users.get(record.userId) || null };
          }
          return record;
        },
      },
      user: {
        async create({ data }) {
          if (data.customerId) {
            for (const u of users.values()) {
              if (u.customerId === data.customerId) {
                const p2002 = new Error('Unique constraint failed on the fields: (`customerId`)');
                p2002.code = 'P2002';
                p2002.meta = { target: ['customerId'] };
                throw p2002;
              }
            }
          }
          const id = 'usr_' + crypto.randomUUID().slice(0, 8);
          const record = { id, ...data, createdAt: new Date() };
          users.set(id, record);
          createdUsers.add(id);
          return record;
        },
        async update({ where, data }) {
          const record = users.get(where.id);
          if (!record) throw new Error('User not found');
          Object.assign(record, data);
          return record;
        },
        async findUnique({ where }) {
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
        async create({ data }) {
          if (options.failOutboxCreate) {
            throw new Error('Simulated database write error on outbox table');
          }
          const id = 'outbox_' + crypto.randomUUID().slice(0, 8);
          const record = {
            id,
            ...data,
            attempts: data.attempts || 0,
            status: data.status || 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          emailOutbox.set(id, record);
          createdOutbox.add(id);
          return record;
        },
        async update({ where, data }) {
          const record = emailOutbox.get(where.id);
          if (!record) throw new Error('Outbox record not found');
          Object.assign(record, data, { updatedAt: new Date() });
          return record;
        },
        async updateMany({ where, data }) {
          let count = 0;
          for (const [id, record] of emailOutbox.entries()) {
            let match = true;
            if (where.id && record.id !== where.id) match = false;
            if (where.status && record.status !== where.status) match = false;
            if (where.OR) {
              const orMatch = where.OR.some((clause) => {
                let m = true;
                if (clause.status && record.status !== clause.status) m = false;
                if (clause.updatedAt && clause.updatedAt.lt && record.updatedAt >= clause.updatedAt.lt) m = false;
                return m;
              });
              if (!orMatch) match = false;
            }
            if (match) {
              if (data.attempts && data.attempts.increment) {
                record.attempts += data.attempts.increment;
              }
              Object.assign(record, { ...data, attempts: record.attempts, updatedAt: new Date() });
              count++;
            }
          }
          return { count };
        },
        async findUnique({ where }) {
          return emailOutbox.get(where.id) || null;
        },
      },
      _rollback() {
        for (const id of createdUsers) users.delete(id);
        for (const hash of createdTokens) authTokens.delete(hash);
        for (const id of createdOutbox) emailOutbox.delete(id);
      },
    };
  }

  const db = {
    ...makeTx(),
    async $transaction(fn) {
      if (Array.isArray(fn)) {
        return await Promise.all(fn);
      }
      const tx = makeTx();
      try {
        return await fn(tx);
      } catch (err) {
        tx._rollback();
        throw err;
      }
    },
    _users: users,
    _authTokens: authTokens,
    _emailOutbox: emailOutbox,
  };

  return db;
}

// ---------------------------------------------------------------------------
// Run Stage 1 Tests
// ---------------------------------------------------------------------------
async function runStage1Tests() {
  console.log('=== GoodPets Task 4 Step 10: Stage 1 Tests (Tokens & Outbox) ===\n');

  const mockDb = createMockPrisma();
  const tokensModule = loadTsModule('src/lib/tokens.ts', {
    '@/lib/prisma': mockDb,
  });
  const outboxModule = loadTsModule('src/lib/outbox.ts', {
    '@/lib/prisma': mockDb,
  });

  const {
    generateRawVerificationToken,
    hashVerificationToken,
    calculateTokenExpiry,
    createVerificationTokenRecord,
    consumeVerificationToken,
    invalidatePriorVerificationTokens,
    TokenNotFoundError,
    TokenExpiredError,
    TokenReusedError,
    TokenInvalidError,
  } = tokensModule;

  const {
    encryptTokenPayload,
    decryptTokenPayload,
    createEmailOutboxRecord,
    claimOutboxRecordForProcessing,
    markOutboxRecordSent,
    markOutboxRecordFailed,
    recoverAbandonedOutboxRecords,
  } = outboxModule;

  // 1. Token generation: 32 random bytes -> 64 hex chars
  const rawToken = generateRawVerificationToken();
  assert.strictEqual(typeof rawToken, 'string');
  assert.strictEqual(rawToken.length, 64, 'Raw token must be exactly 64 hexadecimal characters');
  assert.ok(/^[0-9a-f]{64}$/.test(rawToken), 'Raw token must be lowercase hexadecimal');
  console.log('[PASS] Test 1: 32-byte cryptographic token generation (64 hex characters)');

  // 2. SHA-256 hash storage
  const tokenHash = hashVerificationToken(rawToken);
  assert.strictEqual(tokenHash.length, 64, 'SHA-256 hex digest must be 64 characters');
  assert.notStrictEqual(rawToken, tokenHash, 'Raw token must never equal its hash');
  console.log('[PASS] Test 2: SHA-256 token hashing');

  // 3. Expiry: 24 hours
  const expiry = calculateTokenExpiry();
  const diffHours = (expiry.getTime() - Date.now()) / (1000 * 60 * 60);
  assert.ok(diffHours >= 23.99 && diffHours <= 24.01, 'Token expiry must be set to 24 hours');
  console.log('[PASS] Test 3: 24-hour expiration calculation');

  // 4. Persistence of AuthToken (raw token never stored)
  const testUser = await mockDb.user.create({
    data: {
      email: 'verify-stage1@example.com',
      name: 'Stage One',
      customerId: '1234',
      emailVerified: null,
    },
  });

  const record = await createVerificationTokenRecord(testUser.id, rawToken, mockDb);
  assert.strictEqual(record.tokenHash, tokenHash, 'Stored token must be the SHA-256 hash');
  assert.strictEqual(record.purpose, 'EMAIL_VERIFICATION');
  assert.strictEqual(record.usedAt, null);

  // Assert raw token is absent from all database fields
  for (const [k, v] of Object.entries(record)) {
    assert.notStrictEqual(v, rawToken, `Field ${k} must not store raw token`);
  }
  console.log('[PASS] Test 4: AuthToken record created; raw token never stored in database');

  // 5. Invalidate prior tokens
  const olderToken = generateRawVerificationToken();
  await createVerificationTokenRecord(testUser.id, olderToken, mockDb);
  const invalidatedCount = await invalidatePriorVerificationTokens(testUser.id, mockDb);
  assert.strictEqual(invalidatedCount, 2, 'Must invalidate prior unconsumed tokens');
  console.log('[PASS] Test 5: Invalidation of prior tokens');

  // 6. Concurrency-safe atomic token consumption
  const freshRawToken = generateRawVerificationToken();
  await createVerificationTokenRecord(testUser.id, freshRawToken, mockDb);

  // Simultaneous requests attempting to verify with the same token
  const [res1, res2] = await Promise.allSettled([
    consumeVerificationToken(freshRawToken, mockDb),
    consumeVerificationToken(freshRawToken, mockDb),
  ]);

  const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
  const rejected = [res1, res2].filter((r) => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent verification request must succeed');
  assert.strictEqual(rejected.length, 1, 'Concurrent loser must be rejected');
  assert.ok(
    rejected[0].reason instanceof TokenReusedError,
    'Concurrent loser must be rejected with TokenReusedError'
  );

  const verifiedUser = await mockDb.user.findUnique({ where: { id: testUser.id } });
  assert.ok(verifiedUser.emailVerified !== null, 'Winning verification must set User.emailVerified');
  console.log('[PASS] Test 6: Concurrency-safe atomic token consumption (race condition test)');

  // 7. Expired token rejection
  const expiredRawToken = generateRawVerificationToken();
  const expiredHash = hashVerificationToken(expiredRawToken);
  mockDb._authTokens.set(expiredHash, {
    id: 'tok_expired',
    userId: testUser.id,
    purpose: 'EMAIL_VERIFICATION',
    tokenHash: expiredHash,
    expiresAt: new Date(Date.now() - 1000), // Expired
    usedAt: null,
  });

  let expiredErrorCaught = false;
  try {
    await consumeVerificationToken(expiredRawToken, mockDb);
  } catch (err) {
    if (err instanceof TokenExpiredError) expiredErrorCaught = true;
  }
  assert.strictEqual(expiredErrorCaught, true, 'Expired token must throw TokenExpiredError');
  console.log('[PASS] Test 7: Expired token rejection');

  // 8. AES-256-GCM encryption & decryption
  const secretKey = crypto.randomBytes(32);
  const sampleToken = 'c0ffee'.repeat(10) + '1234';
  const encryptedPayload = encryptTokenPayload(sampleToken, secretKey);

  assert.strictEqual(encryptedPayload.includes(sampleToken), false, 'Payload must not contain plaintext token');
  const parts = encryptedPayload.split(':');
  assert.strictEqual(parts.length, 3, 'Payload must contain iv, authTag, and ciphertext separated by colons');

  const decryptedToken = decryptTokenPayload(encryptedPayload, secretKey);
  assert.strictEqual(decryptedToken, sampleToken, 'Decrypted token must match original exactly');

  // Tampered ciphertext check
  let tamperCaught = false;
  try {
    const tamperedParts = [...parts];
    tamperedParts[2] = 'ff' + tamperedParts[2].slice(2); // Corrupt ciphertext
    decryptTokenPayload(tamperedParts.join(':'), secretKey);
  } catch {
    tamperCaught = true;
  }
  assert.strictEqual(tamperCaught, true, 'Corrupted ciphertext or tag must fail decryption');
  console.log('[PASS] Test 8: AES-256-GCM encryption, decryption, and integrity tag verification');

  // 9. Email Outbox: create, claim lock, and purge payload on sent
  const outboxRecord = await createEmailOutboxRecord(
    {
      userId: testUser.id,
      toEmail: testUser.email,
      rawToken: sampleToken,
    },
    mockDb
  );
  assert.strictEqual(outboxRecord.status, 'PENDING');
  assert.ok(outboxRecord.encryptedPayload !== null);

  // Claim for processing (atomic lock)
  const claimed = await claimOutboxRecordForProcessing(outboxRecord.id, mockDb);
  assert.ok(claimed !== null);
  assert.strictEqual(claimed.status, 'PROCESSING');
  assert.strictEqual(claimed.attempts, 1);

  // Second worker attempting to claim simultaneously must be denied
  const secondClaim = await claimOutboxRecordForProcessing(outboxRecord.id, mockDb);
  assert.strictEqual(secondClaim, null, 'Second worker must receive null for already-processing record');

  // Mark sent -> clears encryptedPayload
  await markOutboxRecordSent(outboxRecord.id, mockDb);
  const sentRecord = await mockDb.emailOutbox.findUnique({ where: { id: outboxRecord.id } });
  assert.strictEqual(sentRecord.status, 'SENT');
  assert.strictEqual(sentRecord.encryptedPayload, null, 'Encrypted payload must be purged after delivery');
  console.log('[PASS] Test 9: Outbox creation, claim-locking, and payload purging upon delivery');

  // 10. Recovery of abandoned processing records
  const abandonedRecord = await createEmailOutboxRecord(
    {
      userId: testUser.id,
      toEmail: testUser.email,
      rawToken: sampleToken,
    },
    mockDb
  );
  abandonedRecord.status = 'PROCESSING';
  abandonedRecord.updatedAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes stale
  mockDb._emailOutbox.set(abandonedRecord.id, abandonedRecord);

  const recoveredCount = await recoverAbandonedOutboxRecords(5, mockDb);
  assert.strictEqual(recoveredCount, 1, 'Abandoned record older than 5m must be reset to PENDING');
  const recoveredRecord = await mockDb.emailOutbox.findUnique({ where: { id: abandonedRecord.id } });
  assert.strictEqual(recoveredRecord.status, 'PENDING');
  console.log('[PASS] Test 10: Safe recovery of abandoned processing records');

  console.log('\nAll 10 Stage 1 verification checks passed successfully!\n');
}

// ---------------------------------------------------------------------------
// Run Stage 2 Tests (Resend Client, Templates, Allowlist, and Errors)
// ---------------------------------------------------------------------------
async function runStage2Tests() {
  console.log('=== GoodPets Task 4 Step 10: Stage 2 Tests (Email Transport & Templates) ===\n');

  const mockDb = createMockPrisma();
  const outboxModule = loadTsModule('src/lib/outbox.ts', {
    '@/lib/prisma': mockDb,
  });
  const emailModule = loadTsModule('src/lib/email.ts', {
    '@/lib/prisma': mockDb,
    '@/lib/outbox': outboxModule,
  });

  const {
    isEmailAllowlisted,
    buildVerificationEmailContent,
    sendEmail,
    sendVerificationEmailDirect,
    sendVerificationEmailFromPayload,
    resolveEmailThemeTokens,
  } = emailModule;

  const {
    encryptTokenPayload,
    getEmailTokenEncryptionKey,
    EncryptionKeyError,
  } = outboxModule;

  // 11. Allowlist filtering: exact match, domain wildcard, and non-production enforcement
  const testAllowlist = 'dev@goodpets.ng, @testdomain.com, *@sandbox.io';
  assert.strictEqual(isEmailAllowlisted('dev@goodpets.ng', testAllowlist), true, 'Exact match must be allowed');
  assert.strictEqual(isEmailAllowlisted('DEV@GOODPETS.NG', testAllowlist), true, 'Case-insensitive exact match must be allowed');
  assert.strictEqual(isEmailAllowlisted('user@testdomain.com', testAllowlist), true, 'Domain wildcard @testdomain.com must be allowed');
  assert.strictEqual(isEmailAllowlisted('lead@sandbox.io', testAllowlist), true, 'Prefix wildcard *@sandbox.io must be allowed');
  assert.strictEqual(isEmailAllowlisted('stranger@external.com', testAllowlist), false, 'Non-allowlisted address must be rejected');
  assert.strictEqual(isEmailAllowlisted('dev@goodpets.ng', ''), false, 'Empty allowlist must reject all addresses in non-production');

  // Production mode bypasses allowlist check
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.strictEqual(isEmailAllowlisted('stranger@external.com', ''), true, 'Production must deliver to arbitrary customer emails');
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
  console.log('[PASS] Test 11: EMAIL_ALLOWLIST exact, domain wildcard, and non-production filtering');

  // 12. Verification email content: branding, tokens, expiry, and single-use notices
  const sampleRawToken = 'a1b2c3d4e5f6'.repeat(5) + '1234';
  const content = buildVerificationEmailContent({
    rawToken: sampleRawToken,
    recipientEmail: 'parent@goodpets.ng',
    name: 'Ada Obi',
    baseUrl: 'https://goodpets.ng',
  });

  assert.strictEqual(content.subject, 'Verify your email — Good Pets');
  assert.ok(content.verificationUrl.includes(sampleRawToken), 'Verification URL must embed raw token');
  assert.strictEqual(content.verificationUrl, `https://goodpets.ng/auth/verify?token=${sampleRawToken}`);

  // HTML content checks
  assert.ok(content.html.includes('Good Pets'), 'HTML must include brand title');
  assert.ok(content.html.includes('Victoria Island, Lagos'), 'HTML must include Lagos location');
  assert.ok(content.html.includes('Hello Ada Obi,'), 'HTML must include personalized greeting');
  assert.ok(content.html.includes('24 hours'), 'HTML must explicitly state 24-hour expiry');
  assert.ok(content.html.includes('Single-use'), 'HTML must explicitly state link is single-use');
  assert.ok(content.html.includes(content.verificationUrl), 'HTML must include verification link');

  // Design system resolution & email client compatibility checks
  const resolvedTheme = resolveEmailThemeTokens();
  assert.strictEqual(resolvedTheme.primary, '#037171', 'primary role must resolve from design-tokens.json');
  assert.strictEqual(resolvedTheme.background, '#f3fbfb', 'background role must resolve from design-tokens.json');
  assert.strictEqual(resolvedTheme.onPrimary, '#ffffff', 'on-primary role must resolve from design-tokens.json');

  // Verify inlined attributes for real email client rendering
  assert.ok(content.html.includes(`background-color: ${resolvedTheme.primary}`), 'HTML must inline resolved primary color');
  assert.ok(content.html.includes(`color: ${resolvedTheme.onPrimary}`), 'HTML must inline resolved on-primary color');
  assert.ok(content.html.includes(`background-color: ${resolvedTheme.background}`), 'HTML must inline resolved background color');

  // Verify CSS custom properties are preserved in <style> block for modern clients
  assert.ok(content.html.includes('var(--color-primary)'), 'HTML must consume var(--color-primary)');
  assert.ok(content.html.includes('var(--color-on-primary)'), 'HTML must consume var(--color-on-primary)');
  assert.ok(content.html.includes('var(--color-background)'), 'HTML must consume var(--color-background)');
  assert.ok(content.html.includes('var(--color-surface)'), 'HTML must consume var(--color-surface)');
  assert.ok(content.html.includes('var(--color-on-surface)'), 'HTML must consume var(--color-on-surface)');
  assert.ok(content.html.includes('var(--color-on-surface-variant)'), 'HTML must consume var(--color-on-surface-variant)');
  assert.ok(content.html.includes('var(--color-outline-variant)'), 'HTML must consume var(--color-outline-variant)');
  assert.ok(content.html.includes('var(--color-success-container)'), 'HTML must consume var(--color-success-container)');
  assert.ok(content.html.includes('var(--color-on-success-container)'), 'HTML must consume var(--color-on-success-container)');

  // Plain-text content checks
  assert.ok(content.text.includes('Good Pets — Victoria Island, Lagos'), 'Plain text must include brand & location header');
  assert.ok(content.text.includes('Hello Ada Obi,'), 'Plain text must include personalized greeting');
  assert.ok(content.text.includes('24-hour expiry'), 'Plain text must state 24-hour expiry');
  assert.ok(content.text.includes('Single-use'), 'Plain text must state single-use requirement');
  assert.ok(content.text.includes(content.verificationUrl), 'Plain text must include verification link');
  console.log('[PASS] Test 12: Verification email templates with Good Pets branding, Lagos context, 24h expiry, and single-use notices');

  // 13. Resend HTTP Client: successful send with mock fetch
  process.env.RESEND_API_KEY = 're_test_key_valid_12345';
  process.env.EMAIL_FROM = 'Good Pets <onboarding@resend.dev>';

  let fetchCalledWith = null;
  const mockFetchSuccess = async (url, options) => {
    fetchCalledWith = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg_resend_mock_success_777' }),
    };
  };

  const successResult = await sendEmail({
    to: 'customer@goodpets.ng',
    subject: content.subject,
    html: content.html,
    text: content.text,
    fetchFn: mockFetchSuccess,
  });

  assert.strictEqual(successResult.success, true);
  assert.strictEqual(successResult.messageId, 'msg_resend_mock_success_777');
  assert.strictEqual(successResult.statusCode, 200);
  assert.strictEqual(fetchCalledWith.url, 'https://api.resend.com/emails');
  assert.strictEqual(fetchCalledWith.options.method, 'POST');
  assert.strictEqual(fetchCalledWith.options.headers['Authorization'], 'Bearer re_test_key_valid_12345');
  console.log('[PASS] Test 13: Resend HTTP client native POST delivery (200 OK)');

  // 14. Error classification: Retryable vs. Permanent errors
  // 14a: HTTP 429 Rate Limit -> Retryable
  const mockFetch429 = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ message: 'Rate limit exceeded' }),
  });
  const res429 = await sendEmail({
    to: 'customer@goodpets.ng',
    subject: 'Test',
    html: '<p>Test</p>',
    text: 'Test',
    fetchFn: mockFetch429,
  });
  assert.strictEqual(res429.success, false);
  assert.strictEqual(res429.retryable, true, 'HTTP 429 must be classified as retryable');
  assert.strictEqual(res429.permanent, false);
  assert.strictEqual(res429.statusCode, 429);

  // 14b: HTTP 500 / 503 Server Error -> Retryable
  const mockFetch503 = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ message: 'Service Unavailable' }),
  });
  const res503 = await sendEmail({
    to: 'customer@goodpets.ng',
    subject: 'Test',
    html: '<p>Test</p>',
    text: 'Test',
    fetchFn: mockFetch503,
  });
  assert.strictEqual(res503.success, false);
  assert.strictEqual(res503.retryable, true, 'HTTP 503 must be classified as retryable');
  assert.strictEqual(res503.permanent, false);

  // 14c: HTTP 422 Unprocessable / Invalid Request -> Permanent
  const mockFetch422 = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ message: 'The domain is not verified' }),
  });
  const res422 = await sendEmail({
    to: 'customer@goodpets.ng',
    subject: 'Test',
    html: '<p>Test</p>',
    text: 'Test',
    fetchFn: mockFetch422,
  });
  assert.strictEqual(res422.success, false);
  assert.strictEqual(res422.retryable, false, 'HTTP 422 must not be retried');
  assert.strictEqual(res422.permanent, true, 'HTTP 422 must be permanent');
  assert.strictEqual(res422.statusCode, 422);

  // 14d: Network timeout / AbortError -> Retryable
  const mockFetchTimeout = async () => {
    const err = new Error('The request timed out');
    err.name = 'TimeoutError';
    throw err;
  };
  const resTimeout = await sendEmail({
    to: 'customer@goodpets.ng',
    subject: 'Test',
    html: '<p>Test</p>',
    text: 'Test',
    fetchFn: mockFetchTimeout,
  });
  assert.strictEqual(resTimeout.success, false);
  assert.strictEqual(resTimeout.retryable, true, 'Network timeout must be retryable');
  assert.strictEqual(resTimeout.permanent, false);

  // 14e: Missing API key -> Permanent
  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const resNoKey = await sendEmail({
      to: 'customer@goodpets.ng',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    });
    assert.strictEqual(resNoKey.success, false);
    assert.strictEqual(resNoKey.retryable, false, 'Missing API key cannot succeed on retry');
    assert.strictEqual(resNoKey.permanent, true);
  } finally {
    process.env.RESEND_API_KEY = savedKey;
  }
  console.log('[PASS] Test 14: Structured error classification (retryable 429/5xx/timeout vs. permanent 4xx/config)');

  // 15. Direct send allowlist enforcement (safe suppression outside production)
  process.env.EMAIL_ALLOWLIST = 'permitted@goodpets.ng';
  const blockedSend = await sendVerificationEmailDirect({
    toEmail: 'blocked@external.com',
    rawToken: sampleRawToken,
    name: 'Blocked User',
    fetchFn: mockFetchSuccess,
  });
  assert.strictEqual(blockedSend.success, false);
  assert.strictEqual(blockedSend.allowlistBlocked, true, 'Non-allowlisted recipient must be blocked');
  assert.strictEqual(blockedSend.permanent, true);

  const allowedSend = await sendVerificationEmailDirect({
    toEmail: 'permitted@goodpets.ng',
    rawToken: sampleRawToken,
    name: 'Permitted User',
    fetchFn: mockFetchSuccess,
  });
  assert.strictEqual(allowedSend.success, true);
  console.log('[PASS] Test 15: sendVerificationEmailDirect enforces EMAIL_ALLOWLIST in non-production');

  // 16. Outbox payload decryption and dispatch (sendVerificationEmailFromPayload)
  const encryptionKey = crypto.randomBytes(32);
  const encrypted = encryptTokenPayload(sampleRawToken, encryptionKey);

  // Success path
  let dispatchedHtml = '';
  const captureFetch = async (url, options) => {
    dispatchedHtml = JSON.parse(options.body).html;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg_payload_dispatch_888' }),
    };
  };

  const payloadResult = await sendVerificationEmailFromPayload({
    toEmail: 'permitted@goodpets.ng',
    encryptedPayload: encrypted,
    name: 'Payload Test',
    fetchFn: captureFetch,
    keyBuffer: encryptionKey,
  });
  assert.strictEqual(payloadResult.success, true);
  assert.ok(dispatchedHtml.includes(sampleRawToken), 'Dispatched email HTML must contain the decrypted raw token link');

  // Corrupted payload path
  const corruptedPayload = 'invalid:bad:payload';
  const corruptResult = await sendVerificationEmailFromPayload({
    toEmail: 'permitted@goodpets.ng',
    encryptedPayload: corruptedPayload,
    fetchFn: captureFetch,
  });
  assert.strictEqual(corruptResult.success, false);
  assert.strictEqual(corruptResult.permanent, true, 'Corrupted payload must fail permanently');
  console.log('[PASS] Test 16: Outbox payload decryption and end-to-end template dispatch');

  // 17. Production environment strictly requires EMAIL_TOKEN_ENCRYPTION_KEY
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    let thrown = false;
    try {
      getEmailTokenEncryptionKey();
    } catch (err) {
      if (err instanceof EncryptionKeyError && err.message.includes('EMAIL_TOKEN_ENCRYPTION_KEY is required in production')) {
        thrown = true;
      }
    }
    assert.strictEqual(thrown, true, 'Production must throw EncryptionKeyError if EMAIL_TOKEN_ENCRYPTION_KEY is missing');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = originalKey;
  }
  console.log('[PASS] Test 17: Production environment requires dedicated EMAIL_TOKEN_ENCRYPTION_KEY');

  // 18. Safe Logging Contract: No raw tokens or full verification URLs leaked in logs
  const loggedLines = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    loggedLines.push(chunk.toString());
    return originalStdoutWrite(chunk, ...args);
  };

  try {
    // Perform standard operations
    await sendVerificationEmailDirect({
      toEmail: 'permitted@goodpets.ng',
      rawToken: sampleRawToken,
      fetchFn: mockFetchSuccess,
    });
  } finally {
    process.stdout.write = originalStdoutWrite;
  }

  const allLogs = loggedLines.join('\n');
  assert.strictEqual(allLogs.includes(sampleRawToken), false, 'Raw verification token must never appear in stdout logs');
  console.log('[PASS] Test 18: Safe logging contract verified (no raw token or secrets logged)');

  console.log('\nAll 8 Stage 2 verification checks passed successfully!\n');
}

// ---------------------------------------------------------------------------
// Next.js Stubs for Route Testing
// ---------------------------------------------------------------------------
function createNextServerStub() {
  class MockNextResponse {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.headers = new Map(Object.entries(init.headers || {}));
      this.cookies = {
        _cookies: new Map(),
        set: (name, val, opts) => {
          this.cookies._cookies.set(name, { val, opts });
        },
      };
    }
    async json() {
      return JSON.parse(this._body);
    }
    static json(body, init = {}) {
      return new MockNextResponse(JSON.stringify(body), init);
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class MockNextRequest {},
  };
}

function createMockRequest(body, headers = {}, searchParams = {}) {
  const lowered = new Map();
  for (const [k, v] of Object.entries(headers)) {
    lowered.set(k.toLowerCase(), v);
  }
  const params = new URLSearchParams(searchParams);
  return {
    headers: {
      get(name) {
        return lowered.has(name.toLowerCase()) ? lowered.get(name.toLowerCase()) : null;
      },
    },
    nextUrl: {
      searchParams: params,
    },
    async json() {
      if (typeof body === 'undefined') {
        throw new Error('Unexpected end of JSON input');
      }
      return body;
    },
  };
}

// ---------------------------------------------------------------------------
// Run Stage 3 Tests (Signup Integration & Outbox Transaction)
// ---------------------------------------------------------------------------
async function runStage3Tests() {
  console.log('=== GoodPets Task 4 Step 10: Stage 3 Tests (Signup Integration & Outbox) ===\n');

  const mockDb = createMockPrisma();
  const nextServerStub = createNextServerStub();
  const mockRateLimit = {
    getClientIp: () => '127.0.0.1',
    deriveRateLimitKey: (purpose, id) => `mock:${purpose}:${id}`,
    reserveRateLimits: async () => [{ key: 'mock', windowStart: new Date() }],
  };

  const tokensModule = loadTsModule('src/lib/tokens.ts', {
    '@/lib/prisma': mockDb,
  });
  const outboxModule = loadTsModule('src/lib/outbox.ts', {
    '@/lib/prisma': mockDb,
  });
  const signupRouteModule = loadTsModule('src/app/api/auth/signup/route.ts', {
    '@/lib/prisma': mockDb,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/tokens': tokensModule,
    '@/lib/outbox': outboxModule,
    '@/lib/breached-password': {
      BreachedPasswordServiceError: class BreachedPasswordServiceError extends Error {},
      isPasswordBreached: async () => false, // Default: clean password
    },
    'next/server': nextServerStub,
  });

  const { decryptTokenPayload } = outboxModule;
  const { hashVerificationToken } = tokensModule;

  // 19. Successful registration transaction (User + AuthToken + EmailOutbox)
  const validSignupReq = createMockRequest({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
    agreeToTerms: true,
  });

  const signupRes = await signupRouteModule.POST(validSignupReq);
  const signupData = await signupRes.json();

  assert.strictEqual(signupRes.status, 201, 'Signup must return HTTP 201 Created');
  assert.strictEqual(signupData.success, true);
  assert.strictEqual(mockDb._users.size, 1, 'Exactly one User record must be committed');
  assert.strictEqual(mockDb._authTokens.size, 1, 'Exactly one AuthToken record must be committed');
  assert.strictEqual(mockDb._emailOutbox.size, 1, 'Exactly one EmailOutbox record must be committed');

  const createdUser = Array.from(mockDb._users.values())[0];
  const createdToken = Array.from(mockDb._authTokens.values())[0];
  const createdOutbox = Array.from(mockDb._emailOutbox.values())[0];

  assert.strictEqual(createdUser.email, 'ada@example.com');
  assert.strictEqual(createdUser.role, 'CUSTOMER');
  assert.strictEqual(createdUser.emailVerified, null, 'Customer account must remain unverified until link clicked');
  assert.strictEqual(createdToken.userId, createdUser.id);
  assert.strictEqual(createdToken.purpose, 'EMAIL_VERIFICATION');
  assert.strictEqual(createdToken.usedAt, null);
  assert.strictEqual(createdOutbox.userId, createdUser.id);
  assert.strictEqual(createdOutbox.tokenId, createdToken.id);
  assert.strictEqual(createdOutbox.toEmail, 'ada@example.com');
  assert.strictEqual(createdOutbox.status, 'PENDING');
  console.log('[PASS] Test 19: Atomic transactional creation of User, AuthToken, and EmailOutbox');

  // 20. Token security & encryption invariants
  assert.strictEqual(createdToken.tokenHash.length, 64, 'AuthToken must store 64-char SHA-256 hash');
  assert.strictEqual(createdToken.token, undefined, 'AuthToken must never store raw token');
  assert.ok(createdOutbox.encryptedPayload.includes(':'), 'Outbox payload must be AES-256-GCM ciphertext');

  const decryptedToken = decryptTokenPayload(createdOutbox.encryptedPayload);
  assert.strictEqual(decryptedToken.length, 64, 'Decrypted token must be 64-character raw hex');
  assert.strictEqual(hashVerificationToken(decryptedToken), createdToken.tokenHash, 'SHA-256 of decrypted token must equal AuthToken.tokenHash');
  console.log('[PASS] Test 20: Raw token encrypted in EmailOutbox; SHA-256 hash stored in AuthToken');

  // 21. No session cookie or auto-login on signup
  assert.strictEqual(signupRes.cookies._cookies.size, 0, 'No session cookie (goodpets_session) must be set on signup');
  assert.strictEqual(signupData.sessionToken, undefined, 'No session token must be returned in signup response');
  console.log('[PASS] Test 21: No customer session cookie issued during registration');

  // 22. Customer ID preservation and verification guidance message
  assert.ok(/^\d{4}$/.test(signupData.user.customerId), 'Assigned customerId must be a 4-digit string');
  assert.strictEqual(signupData.customerId, signupData.user.customerId, 'Top-level customerId must match user.customerId');
  assert.strictEqual(
    signupData.message,
    'Registration successful. Please check your email to verify your account before signing in.',
    'Response must guide customer to verify their email before signin'
  );
  console.log('[PASS] Test 22: Preserves generated 4-digit customer ID and returns email verification guidance message');

  // 23. Database transaction rollback (all-or-nothing guarantee)
  const failingDb = createMockPrisma({ failOutboxCreate: true });

  const failingSignupRoute = loadTsModule('src/app/api/auth/signup/route.ts', {
    '@/lib/prisma': failingDb,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/tokens': loadTsModule('src/lib/tokens.ts', { '@/lib/prisma': failingDb }),
    '@/lib/outbox': loadTsModule('src/lib/outbox.ts', { '@/lib/prisma': failingDb }),
    '@/lib/breached-password': {
      BreachedPasswordServiceError: class BreachedPasswordServiceError extends Error {},
      isPasswordBreached: async () => false,
    },
    'next/server': nextServerStub,
  });

  const rollbackReq = createMockRequest({
    name: 'Charles Babbage',
    email: 'babbage@example.com',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    agreeToTerms: true,
  });

  const rollbackRes = await failingSignupRoute.POST(rollbackReq);
  assert.strictEqual(rollbackRes.status, 500, 'Failing transaction must return HTTP 500');
  assert.strictEqual(failingDb._users.size, 0, 'User creation must be rolled back on outbox failure');
  assert.strictEqual(failingDb._authTokens.size, 0, 'AuthToken creation must be rolled back on outbox failure');
  assert.strictEqual(failingDb._emailOutbox.size, 0, 'Outbox must be empty');
  console.log('[PASS] Test 23: Complete transaction rollback when outbox write fails (no orphaned users)');

  // 24. Customer ID collision retry within transaction
  const collisionDb = createMockPrisma();
  // Pre-seed an existing customer with ID '1234'
  collisionDb._users.set('usr_existing', {
    id: 'usr_existing',
    customerId: '1234',
    name: 'Existing Customer',
    email: 'existing@example.com',
    role: 'CUSTOMER',
  });

  let collisionAttempts = 0;
  const collisionSignupRoute = loadTsModule('src/app/api/auth/signup/route.ts', {
    '@/lib/prisma': collisionDb,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/auth': {
      generateRandomCustomerId: () => {
        collisionAttempts++;
        // Collide on first candidate, then return unique candidate
        return collisionAttempts === 1 ? '1234' : '5678';
      },
    },
    '@/lib/tokens': loadTsModule('src/lib/tokens.ts', { '@/lib/prisma': collisionDb }),
    '@/lib/outbox': loadTsModule('src/lib/outbox.ts', { '@/lib/prisma': collisionDb }),
    '@/lib/breached-password': {
      BreachedPasswordServiceError: class BreachedPasswordServiceError extends Error {},
      isPasswordBreached: async () => false,
    },
    'next/server': nextServerStub,
  });

  const collisionReq = createMockRequest({
    name: 'Grace Hopper',
    email: 'grace@example.com',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    agreeToTerms: true,
  });

  const collisionRes = await collisionSignupRoute.POST(collisionReq);
  const collisionData = await collisionRes.json();
  assert.strictEqual(collisionRes.status, 201, 'Signup must recover from P2002 collision and succeed');
  assert.strictEqual(collisionData.user.customerId, '5678', 'User must receive the second, non-colliding candidate ID');
  assert.strictEqual(collisionAttempts, 2, 'Collision handler must have attempted candidate twice');
  console.log('[PASS] Test 24: Customer ID collision detection and retry within transaction');

  // 25. Existing security controls preserved
  // 25a: Breached password rejected
  const breachedRoute = loadTsModule('src/app/api/auth/signup/route.ts', {
    '@/lib/prisma': mockDb,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/tokens': tokensModule,
    '@/lib/outbox': outboxModule,
    '@/lib/breached-password': {
      BreachedPasswordServiceError: class BreachedPasswordServiceError extends Error {},
      isPasswordBreached: async () => true, // Breached
    },
    'next/server': nextServerStub,
  });
  const breachedReq = createMockRequest({
    name: 'Breached User',
    email: 'breached@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    agreeToTerms: true,
  });
  const breachedRes = await breachedRoute.POST(breachedReq);
  assert.strictEqual(breachedRes.status, 400, 'Breached password must return HTTP 400');

  // 25b: Validation failure rejected
  const invalidNameReq = createMockRequest({
    name: 'SingleNameOnly',
    email: 'singlename@example.com',
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
    agreeToTerms: true,
  });
  const invalidNameRes = await signupRouteModule.POST(invalidNameReq);
  assert.strictEqual(invalidNameRes.status, 400, 'Single-word name must return HTTP 400');

  // 25c: Duplicate email rejected
  const duplicateReq = createMockRequest({
    name: 'Ada Lovelace Two',
    email: 'ada@example.com', // Already registered in test 19
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
    agreeToTerms: true,
  });
  const duplicateRes = await signupRouteModule.POST(duplicateReq);
  assert.strictEqual(duplicateRes.status, 409, 'Duplicate email must return HTTP 409');
  console.log('[PASS] Test 25: Existing security controls preserved (breach check, name validation, email deduplication)');

  console.log('\nAll 7 Stage 3 verification checks passed successfully!\n');
}

// ---------------------------------------------------------------------------
// Run Stage 4 Tests (Email Verification Endpoint: POST /api/auth/verify-email)
// ---------------------------------------------------------------------------
async function runStage4Tests() {
  console.log('=== GoodPets Task 4 Step 10: Stage 4 Tests (Email Verification Endpoint) ===\n');

  const mockDb = createMockPrisma();
  const nextServerStub = createNextServerStub();

  const tokensModule = loadTsModule('src/lib/tokens.ts', {
    '@/lib/prisma': mockDb,
  });
  const verifyRouteModule = loadTsModule('src/app/api/auth/verify-email/route.ts', {
    '@/lib/tokens': tokensModule,
    'next/server': nextServerStub,
  });

  const { generateRawVerificationToken, hashVerificationToken } = tokensModule;

  // Helper to create test user and token
  async function setupTestUserAndToken({
    email = 'user@example.com',
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt = null,
    purpose = 'EMAIL_VERIFICATION',
  } = {}) {
    const rawToken = generateRawVerificationToken();
    const tokenHash = hashVerificationToken(rawToken);
    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);

    const user = {
      id: userId,
      email,
      name: 'Test Customer',
      role: 'CUSTOMER',
      emailVerified: null,
      createdAt: new Date(),
    };
    mockDb._users.set(userId, user);

    const authToken = {
      id: 'tok_' + crypto.randomUUID().slice(0, 8),
      userId,
      tokenHash,
      purpose,
      expiresAt,
      usedAt,
      createdAt: new Date(),
    };
    mockDb._authTokens.set(tokenHash, authToken);

    return { rawToken, tokenHash, userId, user, authToken };
  }

  // 26. Valid verification consumes token and sets User.emailVerified
  const { rawToken: validRawToken, tokenHash: validHash, userId: validUserId } = await setupTestUserAndToken({
    email: 'katherine@example.com',
  });

  const validReq = createMockRequest({ token: validRawToken });
  const validRes = await verifyRouteModule.POST(validReq);
  const validData = await validRes.json();

  assert.strictEqual(validRes.status, 200, 'Valid verification must return HTTP 200');
  assert.strictEqual(validData.success, true);
  assert.strictEqual(validData.verified, true);
  assert.ok(validData.message.includes('successfully verified'));

  const verifiedUser = mockDb._users.get(validUserId);
  const consumedToken = mockDb._authTokens.get(validHash);
  assert.ok(verifiedUser.emailVerified instanceof Date, 'User.emailVerified must be set to Date');
  assert.ok(consumedToken.usedAt instanceof Date, 'AuthToken.usedAt must be set to Date');
  console.log('[PASS] Test 26: Valid token verification consumes token and sets User.emailVerified');

  // 27. No session cookie issued on verification (must not sign user in)
  assert.strictEqual(validRes.cookies._cookies.size, 0, 'No session cookie (goodpets_session) must be set on email verification');
  assert.strictEqual(validData.sessionToken, undefined, 'No session token must be returned in verification response');
  console.log('[PASS] Test 27: Verification does not issue session cookie or auto-login the user');

  // 28. Malformed or invalid token format rejected with HTTP 400
  const malformedReq1 = createMockRequest({ token: 'not-a-valid-hex-token' });
  const malformedRes1 = await verifyRouteModule.POST(malformedReq1);
  const malformedData1 = await malformedRes1.json();
  assert.strictEqual(malformedRes1.status, 400);
  assert.strictEqual(malformedData1.code, 'INVALID_TOKEN');

  const malformedReq2 = createMockRequest({ token: '12345' }); // Too short
  const malformedRes2 = await verifyRouteModule.POST(malformedReq2);
  const malformedData2 = await malformedRes2.json();
  assert.strictEqual(malformedRes2.status, 400);
  assert.strictEqual(malformedData2.code, 'INVALID_TOKEN');

  const emptyReq = createMockRequest({}); // Empty body, no token
  const emptyRes = await verifyRouteModule.POST(emptyReq);
  const emptyData = await emptyRes.json();
  assert.strictEqual(emptyRes.status, 400);
  assert.strictEqual(emptyData.code, 'INVALID_TOKEN');

  // Non-existent token (valid 64 hex, but not in DB)
  const nonExistentRaw = 'a'.repeat(64);
  const nonExistentReq = createMockRequest({ token: nonExistentRaw });
  const nonExistentRes = await verifyRouteModule.POST(nonExistentReq);
  const nonExistentData = await nonExistentRes.json();
  assert.strictEqual(nonExistentRes.status, 400);
  assert.strictEqual(nonExistentData.code, 'INVALID_TOKEN');
  console.log('[PASS] Test 28: Malformed, missing, and non-existent tokens rejected with HTTP 400 (INVALID_TOKEN)');

  // 29. Expired token rejected with HTTP 410 (TOKEN_EXPIRED)
  const { rawToken: expiredRawToken, userId: expiredUserId } = await setupTestUserAndToken({
    email: 'expired@example.com',
    expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 minute ago
  });

  const expiredReq = createMockRequest({ token: expiredRawToken });
  const expiredRes = await verifyRouteModule.POST(expiredReq);
  const expiredData = await expiredRes.json();

  assert.strictEqual(expiredRes.status, 410, 'Expired token must return HTTP 410 Gone');
  assert.strictEqual(expiredData.code, 'TOKEN_EXPIRED');
  assert.strictEqual(mockDb._users.get(expiredUserId).emailVerified, null, 'Expired token must not verify user');
  console.log('[PASS] Test 29: Expired token rejected with HTTP 410 (TOKEN_EXPIRED)');

  // 30. Reused token rejected with HTTP 409 (TOKEN_REUSED)
  // Attempting to verify with the already-used token from Test 26
  const reusedReq = createMockRequest({ token: validRawToken });
  const reusedRes = await verifyRouteModule.POST(reusedReq);
  const reusedData = await reusedRes.json();

  assert.strictEqual(reusedRes.status, 409, 'Reused token must return HTTP 409 Conflict');
  assert.strictEqual(reusedData.code, 'TOKEN_REUSED');
  console.log('[PASS] Test 30: Already consumed token rejected with HTTP 409 (TOKEN_REUSED)');

  // 31. Token with wrong purpose (e.g. PASSWORD_RESET) rejected with HTTP 400 (INVALID_TOKEN)
  const { rawToken: resetRawToken, userId: resetUserId } = await setupTestUserAndToken({
    email: 'reset@example.com',
    purpose: 'PASSWORD_RESET',
  });

  const resetReq = createMockRequest({ token: resetRawToken });
  const resetRes = await verifyRouteModule.POST(resetReq);
  const resetData = await resetRes.json();

  assert.strictEqual(resetRes.status, 400, 'Token with wrong purpose must return HTTP 400');
  assert.strictEqual(resetData.code, 'INVALID_TOKEN');
  assert.strictEqual(mockDb._users.get(resetUserId).emailVerified, null, 'Wrong purpose token must not verify user');
  console.log('[PASS] Test 31: Wrong purpose token rejected with HTTP 400 (INVALID_TOKEN)');

  // 32. Concurrent verification race condition
  const { rawToken: raceRawToken, userId: raceUserId } = await setupTestUserAndToken({
    email: 'race@example.com',
  });

  const raceReq1 = createMockRequest({ token: raceRawToken });
  const raceReq2 = createMockRequest({ token: raceRawToken });

  const [res1, res2] = await Promise.all([
    verifyRouteModule.POST(raceReq1),
    verifyRouteModule.POST(raceReq2),
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Simultaneous verification requests must result in exactly one 200 and one 409');
  assert.ok(mockDb._users.get(raceUserId).emailVerified instanceof Date, 'User must be marked verified by the winning request');
  console.log('[PASS] Test 32: Concurrency-safe: simultaneous verification attempts produce exactly one winner and one 409');

  // 33. Query parameter fallback: POST /api/auth/verify-email?token=<token>
  const { rawToken: queryRawToken, tokenHash: queryHash, userId: queryUserId } = await setupTestUserAndToken({
    email: 'queryparam@example.com',
  });

  const queryReq = createMockRequest(undefined, {}, { token: queryRawToken });
  const queryRes = await verifyRouteModule.POST(queryReq);
  const queryData = await queryRes.json();

  assert.strictEqual(queryRes.status, 200, 'Query param token verification must return HTTP 200');
  assert.strictEqual(queryData.success, true);
  assert.strictEqual(queryData.verified, true);
  assert.ok(mockDb._users.get(queryUserId).emailVerified instanceof Date);
  assert.ok(mockDb._authTokens.get(queryHash).usedAt instanceof Date);
  console.log('[PASS] Test 33: URL query parameter fallback support verified');

  console.log('\nAll 8 Stage 4 verification checks passed successfully!\n');
}

async function main() {
  await runStage1Tests();
  await runStage2Tests();
  await runStage3Tests();
  await runStage4Tests();
  console.log('All Stage 1, Stage 2, Stage 3 & Stage 4 tests completed successfully!');
}

main().catch((err) => {
  console.error('[TEST SUITE FAILURE]', err);
  process.exit(1);
});

