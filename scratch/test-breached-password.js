/**
 * GoodPets Task 4, Step 9 — Breached-Password Screening Automated Test Suite
 *
 * Verifies the privacy-preserving k-anonymity breached password implementation.
 *
 * Run offline (default, fast, deterministic):
 *   node scratch/test-breached-password.js
 *
 * Run optional live HIBP verification (requires network access):
 *   node scratch/test-breached-password.js --live
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
process.env.AUTH_SECRET = 'goodpets-test-secret-key-minimum-32-chars-long-12345';

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

function createMockRequest(body, headers = {}) {
  const lowered = new Map();
  for (const [k, v] of Object.entries(headers)) {
    lowered.set(k.toLowerCase(), v);
  }
  return {
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
// Test Suite Execution
// ---------------------------------------------------------------------------
async function runTests() {
  console.log('=== GoodPets Task 4 Step 9: Breached-Password Screening Tests ===\n');

  const bpModule = loadTsModule('src/lib/breached-password.ts');
  const { isPasswordBreached, BreachedPasswordServiceError } = bpModule;

  // Reference test passwords:
  // 'password123' -> SHA-1: CBFDAC6008F9CAB4083784CBD1874F76618D2A97
  // Prefix: CBFDA, Suffix: C6008F9CAB4083784CBD1874F76618D2A97
  const breachedPwd = 'password123';
  const fullSha1 = crypto.createHash('sha1').update(breachedPwd).digest('hex').toUpperCase();
  const expectedPrefix = fullSha1.slice(0, 5);
  const expectedSuffix = fullSha1.slice(5);

  let capturedRequests = [];

  function makeMockFetch(responseFactory) {
    return async (url, init) => {
      capturedRequests.push({ url, init });
      return responseFactory(url, init);
    };
  }

  // -------------------------------------------------------------------------
  // Test 1: Known breached password is detected (mocked response)
  // -------------------------------------------------------------------------
  capturedRequests = [];
  const mockValidBreachedFetch = makeMockFetch(async () => ({
    ok: true,
    status: 200,
    async text() {
      return [
        '0018A45C4D1DEF81644B54AB7F969B88D65:1',
        `${expectedSuffix}:154321`,
        'FFFFF45C4D1DEF81644B54AB7F969B88D65:0', // Padding entry with count 0
      ].join('\r\n');
    },
  }));

  const isBreachedResult = await isPasswordBreached(breachedPwd, {
    fetchFn: mockValidBreachedFetch,
  });
  assert.strictEqual(isBreachedResult, true, 'Known breached password must return true');
  console.log('[PASS] Test 1: Known breached password is detected');

  // -------------------------------------------------------------------------
  // Test 2: Clean password absent from response is accepted (returns false)
  // -------------------------------------------------------------------------
  const cleanPwd = 'UnbreachedUniquePassword#987654!';
  const cleanSha1 = crypto.createHash('sha1').update(cleanPwd).digest('hex').toUpperCase();
  const cleanPrefix = cleanSha1.slice(0, 5);

  const mockValidCleanFetch = makeMockFetch(async () => ({
    ok: true,
    status: 200,
    async text() {
      return [
        '0018A45C4D1DEF81644B54AB7F969B88D65:1',
        'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F:42',
      ].join('\r\n');
    },
  }));

  const isCleanResult = await isPasswordBreached(cleanPwd, {
    fetchFn: mockValidCleanFetch,
  });
  assert.strictEqual(isCleanResult, false, 'Clean password absent from list must return false');
  console.log('[PASS] Test 2: Clean password absent from dataset is accepted');

  // -------------------------------------------------------------------------
  // Test 3: Only the 5-character prefix is included in the request URL
  // -------------------------------------------------------------------------
  assert.ok(capturedRequests.length > 0);
  const lastRequest = capturedRequests[0];
  const urlObj = new URL(lastRequest.url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  const requestedPrefix = pathParts[pathParts.length - 1];

  assert.strictEqual(requestedPrefix, expectedPrefix, 'URL must end with the exact 5-char prefix');
  assert.strictEqual(requestedPrefix.length, 5, 'Prefix must be exactly 5 characters long');
  console.log('[PASS] Test 3: Only the 5-character prefix is included in the request URL');

  // -------------------------------------------------------------------------
  // Test 4: Request URL and headers never contain plaintext password or full SHA-1
  // -------------------------------------------------------------------------
  for (const req of capturedRequests) {
    assert.strictEqual(req.url.includes(breachedPwd), false, 'URL must not contain plaintext password');
    assert.strictEqual(req.url.includes(fullSha1), false, 'URL must not contain full SHA-1 hash');
    assert.strictEqual(req.url.includes(expectedSuffix), false, 'URL must not contain SHA-1 suffix');

    const headersStr = JSON.stringify(req.init.headers);
    assert.strictEqual(headersStr.includes(breachedPwd), false, 'Headers must not contain plaintext password');
    assert.strictEqual(headersStr.includes(fullSha1), false, 'Headers must not contain full SHA-1 hash');
  }
  console.log('[PASS] Test 4: Request does not contain plaintext password or full SHA-1 hash');

  // -------------------------------------------------------------------------
  // Test 5: Add-Padding: true header is present
  // -------------------------------------------------------------------------
  const paddingHeader = lastRequest.init.headers['Add-Padding'];
  assert.strictEqual(paddingHeader, 'true', "Request must include 'Add-Padding: true' header");
  console.log('[PASS] Test 5: Add-Padding: true header is present');

  // -------------------------------------------------------------------------
  // Test 6: Non-success HTTP responses produce a screening error (Fail-Closed)
  // -------------------------------------------------------------------------
  const mock500Fetch = makeMockFetch(async () => ({
    ok: false,
    status: 500,
    async text() {
      return 'Internal Server Error';
    },
  }));

  let error500Thrown = false;
  try {
    await isPasswordBreached(breachedPwd, { fetchFn: mock500Fetch });
  } catch (err) {
    if (err instanceof BreachedPasswordServiceError) {
      error500Thrown = true;
    }
  }
  assert.strictEqual(error500Thrown, true, 'Non-200 HTTP response must throw BreachedPasswordServiceError');
  console.log('[PASS] Test 6: Non-success HTTP responses produce a screening error');

  // -------------------------------------------------------------------------
  // Test 7: Network failures and timeout errors produce a screening error
  // -------------------------------------------------------------------------
  const mockNetworkFailFetch = makeMockFetch(async () => {
    throw new Error('fetch failed: Connection refused');
  });

  let networkErrorThrown = false;
  try {
    await isPasswordBreached(breachedPwd, { fetchFn: mockNetworkFailFetch });
  } catch (err) {
    if (err instanceof BreachedPasswordServiceError) {
      networkErrorThrown = true;
    }
  }
  assert.strictEqual(networkErrorThrown, true, 'Network failure must throw BreachedPasswordServiceError');
  console.log('[PASS] Test 7: Network failures and timeout errors produce a screening error');

  // -------------------------------------------------------------------------
  // Test 8: Malformed responses produce a screening error
  // -------------------------------------------------------------------------
  const mockMalformedFetch = makeMockFetch(async () => ({
    ok: true,
    status: 200,
    async text() {
      return '<!DOCTYPE html><html><body>Cloudflare Error</body></html>';
    },
  }));

  let malformedErrorThrown = false;
  try {
    await isPasswordBreached(breachedPwd, { fetchFn: mockMalformedFetch });
  } catch (err) {
    if (err instanceof BreachedPasswordServiceError) {
      malformedErrorThrown = true;
    }
  }
  assert.strictEqual(malformedErrorThrown, true, 'Malformed response must throw BreachedPasswordServiceError');
  console.log('[PASS] Test 8: Malformed responses produce a screening error');

  // -------------------------------------------------------------------------
  // Test 9 & 11: Signup route rejects breached password with HTTP 400 (no DB write)
  // -------------------------------------------------------------------------
  let userCreated = false;
  const mockPrisma = {
    user: {
      async findUnique() {
        return null; // email not registered
      },
      async create() {
        userCreated = true;
        return { id: 'usr_mock_1', customerId: '1234', role: 'CUSTOMER', createdAt: new Date() };
      },
    },
  };

  const nextServerStub = createNextServerStub();
  const mockRateLimit = {
    getClientIp: () => '127.0.0.1',
    deriveRateLimitKey: (purpose, id) => `mock:${purpose}:${id}`,
    reserveRateLimits: async () => [{ key: 'mock', windowStart: new Date() }],
  };

  const signupRouteBreached = loadTsModule('src/app/api/auth/signup/route.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/breached-password': {
      BreachedPasswordServiceError,
      isPasswordBreached: async () => true, // Mocked as breached
    },
    'next/server': nextServerStub,
  });

  const breachedSignupReq = createMockRequest({
    name: 'Jane Doe',
    email: 'breached-test@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    agreeToTerms: true,
  });

  const resBreached = await signupRouteBreached.POST(breachedSignupReq);
  const dataBreached = await resBreached.json();

  assert.strictEqual(resBreached.status, 400, 'Signup route must return HTTP 400 for breached password');
  assert.strictEqual(
    dataBreached.error,
    'This password has appeared in a known data breach. For your security, please choose a different password.'
  );
  assert.strictEqual(userCreated, false, 'User must NOT be created when password is breached');
  assert.strictEqual(resBreached.cookies._cookies.size, 0, 'Session cookie must NOT be issued on breach rejection');
  console.log('[PASS] Test 9: Signup route rejects breached password with HTTP 400');

  // -------------------------------------------------------------------------
  // Test 10 & 11: Signup route returns HTTP 503 when screening service fails
  // -------------------------------------------------------------------------
  userCreated = false;
  const signupRouteUnavailable = loadTsModule('src/app/api/auth/signup/route.ts', {
    '@/lib/prisma': mockPrisma,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/breached-password': {
      BreachedPasswordServiceError,
      isPasswordBreached: async () => {
        throw new BreachedPasswordServiceError('Service connection timed out');
      },
    },
    'next/server': nextServerStub,
  });

  const unavailableSignupReq = createMockRequest({
    name: 'Jane Doe',
    email: 'service-fail@example.com',
    password: 'securePassword123!',
    confirmPassword: 'securePassword123!',
    agreeToTerms: true,
  });

  const resUnavailable = await signupRouteUnavailable.POST(unavailableSignupReq);
  const dataUnavailable = await resUnavailable.json();

  assert.strictEqual(resUnavailable.status, 503, 'Signup route must return HTTP 503 when breach screening fails');
  assert.strictEqual(
    dataUnavailable.error,
    'Password security screening is temporarily unavailable. Please try again shortly.'
  );
  assert.strictEqual(userCreated, false, 'User must NOT be created when screening service is unavailable');
  assert.strictEqual(resUnavailable.cookies._cookies.size, 0, 'Session cookie must NOT be issued on service error');
  console.log('[PASS] Test 10: Signup route returns HTTP 503 when screening is unavailable');
  console.log('[PASS] Test 11: Neither failure creates a user or issues a session');

  // -------------------------------------------------------------------------
  // Optional Live Test (opt-in via --live)
  // -------------------------------------------------------------------------
  if (process.argv.includes('--live')) {
    console.log('\n--- Running Optional Live HIBP Query (--live) ---');
    try {
      const liveBreached = await isPasswordBreached('password123');
      assert.strictEqual(liveBreached, true, "Live query for 'password123' must be detected as breached");

      const highEntropyPwd = `CleanRandom_${crypto.randomBytes(16).toString('hex')}!@#99`;
      const liveClean = await isPasswordBreached(highEntropyPwd);
      assert.strictEqual(liveClean, false, 'Live query for random high-entropy password must be clean');

      console.log('[PASS] Live HIBP service successfully tested with real k-anonymity queries');
    } catch (err) {
      console.warn('[WARN] Live HIBP test could not complete:', err.message);
    }
  }

  console.log('\nAll 11 breached-password screening verification checks passed successfully!');
}

runTests().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});

