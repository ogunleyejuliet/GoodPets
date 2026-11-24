const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { hash } = require('@node-rs/argon2');

console.log('=== GoodPets Task 4 Step 10: Stage 5 Tests (Sign-in Enforcement & Unverified Account Gating) ===\n');

process.env.AUTH_SECRET = 'super-secret-test-auth-encryption-key-32chars!';
process.env.NODE_ENV = 'test';

const ROOT = path.resolve(__dirname, '..');

// Helper to load and transpile TypeScript modules with custom mocks
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

// Next.js stubs
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
      if (typeof body === 'undefined') {
        throw new Error('Unexpected end of JSON input');
      }
      return body;
    },
  };
}

async function main() {
  // Precompute Argon2id password hash for tests
  const testPassword = 'Password123!';
  const passwordHash = await hash(testPassword, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  // Mock DB store for users
  const mockUsers = new Map();

  const mockDb = {
    user: {
      async findUnique({ where, select }) {
        let u = null;
        if (where.email) {
          u = mockUsers.get(where.email.toLowerCase()) || null;
        } else if (where.id) {
          for (const user of mockUsers.values()) {
            if (user.id === where.id) {
              u = user;
              break;
            }
          }
        }
        if (!u) return null;
        if (select) {
          const res = {};
          for (const k of Object.keys(select)) {
            if (select[k]) res[k] = u[k];
          }
          return res;
        }
        return { ...u };
      },
    },
    pet: {
      async findMany({ where }) {
        return [];
      },
    },
    booking: {
      async findMany({ where }) {
        return [];
      },
    },
  };

  let currentCookieToken = null;
  const mockNextHeaders = {
    cookies: () => ({
      get: (name) => {
        if (name === 'goodpets_session' && currentCookieToken) {
          return { name, value: currentCookieToken };
        }
        return undefined;
      },
    }),
  };

  const nextServerStub = createNextServerStub();

  const mockRateLimit = {
    getClientIp: () => '127.0.0.1',
    deriveRateLimitKey: (purpose, id) => `mock:${purpose}:${id}`,
    reserveRateLimits: async () => [{ key: 'mock', windowStart: new Date() }],
    decrementRateLimits: async () => {},
    redactKeyForLog: (k) => k,
  };

  // Load auth library
  const authModule = loadTsModule('src/lib/auth.ts', {
    '@/lib/prisma': mockDb,
    'next/headers': mockNextHeaders,
  });

  // Load signin route
  const signinRoute = loadTsModule('src/app/api/auth/signin/route.ts', {
    '@/lib/prisma': mockDb,
    '@/lib/auth': authModule,
    '@/lib/rate-limit': mockRateLimit,
    'next/server': nextServerStub,
  });

  // Load protected customer routes
  const meRoute = loadTsModule('src/app/api/auth/me/route.ts', {
    '@/lib/auth': authModule,
    'next/server': nextServerStub,
  });

  const petsRoute = loadTsModule('src/app/api/pets/route.ts', {
    '@/lib/auth': authModule,
    '@/lib/prisma': mockDb,
    'next/server': nextServerStub,
  });

  const bookingsRoute = loadTsModule('src/app/api/bookings/route.ts', {
    '@/lib/auth': authModule,
    '@/lib/prisma': mockDb,
    '@/lib/rate-limit': mockRateLimit,
    '@/lib/capacity': {
      createBookingWithCapacityHold: async () => ({ booking: { id: 'bk_1' } }),
    },
    'next/server': nextServerStub,
  });

  const { requireUser, signSessionToken } = authModule;

  // Seed test accounts in mockDb
  const unverifiedCustomer = {
    id: 'usr_unverified_1',
    customerId: '1111',
    email: 'unverified@example.com',
    name: 'Unverified Customer',
    phone: '08011111111',
    passwordHash,
    role: 'CUSTOMER',
    isActive: true,
    sessionVersion: 1,
    emailVerified: null, // Unverified
    createdAt: new Date(),
  };
  mockUsers.set(unverifiedCustomer.email, unverifiedCustomer);

  const verifiedCustomer = {
    id: 'usr_verified_1',
    customerId: '2222',
    email: 'verified@example.com',
    name: 'Verified Customer',
    phone: '08022222222',
    passwordHash,
    role: 'CUSTOMER',
    isActive: true,
    sessionVersion: 1,
    emailVerified: new Date(), // Verified
    createdAt: new Date(),
  };
  mockUsers.set(verifiedCustomer.email, verifiedCustomer);

  const frontDeskStaff = {
    id: 'usr_frontdesk_1',
    customerId: null,
    email: 'reception@goodpets.ng',
    name: 'Front Desk Tola',
    phone: '08033333333',
    passwordHash,
    role: 'FRONT_DESK',
    isActive: true,
    sessionVersion: 1,
    emailVerified: null, // Staff has null customer email verification
    createdAt: new Date(),
  };
  mockUsers.set(frontDeskStaff.email, frontDeskStaff);

  const managerStaff = {
    id: 'usr_manager_1',
    customerId: null,
    email: 'manager@goodpets.ng',
    name: 'Manager Kunle',
    phone: '08044444444',
    passwordHash,
    role: 'MANAGER',
    isActive: true,
    sessionVersion: 1,
    emailVerified: null, // Staff has null customer email verification
    createdAt: new Date(),
  };
  mockUsers.set(managerStaff.email, managerStaff);

  // ---------------------------------------------------------------------------
  // Test 1: Unverified CUSTOMER with correct password is denied sign-in
  // ---------------------------------------------------------------------------
  const unverifiedReq = createMockRequest({
    email: unverifiedCustomer.email,
    customerId: unverifiedCustomer.customerId,
    password: testPassword,
  });
  const unverifiedRes = await signinRoute.POST(unverifiedReq);
  const unverifiedData = await unverifiedRes.json();

  assert.strictEqual(unverifiedRes.status, 403, 'Unverified customer sign-in must return HTTP 403');
  assert.strictEqual(unverifiedData.success, false);
  assert.strictEqual(unverifiedData.error, 'Verify your email first.');
  assert.strictEqual(unverifiedData.code, 'EMAIL_NOT_VERIFIED');
  assert.strictEqual(unverifiedData.verificationUrl, '/auth/verify');
  console.log('[PASS] Test 1: Unverified CUSTOMER with correct password is denied sign-in (HTTP 403: "Verify your email first.")');

  // ---------------------------------------------------------------------------
  // Test 2: Denied sign-in does not issue a session cookie
  // ---------------------------------------------------------------------------
  assert.strictEqual(
    unverifiedRes.cookies._cookies.size,
    0,
    'Denied sign-in must not set any cookies'
  );
  assert.strictEqual(
    unverifiedData.sessionToken,
    undefined,
    'Denied sign-in must not return a sessionToken'
  );
  console.log('[PASS] Test 2: Denied sign-in does not issue a session cookie or return token');

  // ---------------------------------------------------------------------------
  // Test 3: Verified CUSTOMER can sign in successfully
  // ---------------------------------------------------------------------------
  const verifiedReq = createMockRequest({
    email: verifiedCustomer.email,
    customerId: verifiedCustomer.customerId,
    password: testPassword,
  });
  const verifiedRes = await signinRoute.POST(verifiedReq);
  const verifiedData = await verifiedRes.json();

  assert.strictEqual(verifiedRes.status, 200, 'Verified customer sign-in must return HTTP 200');
  assert.strictEqual(verifiedData.success, true);
  assert.strictEqual(verifiedData.user.id, verifiedCustomer.id);
  assert.strictEqual(verifiedData.user.email, verifiedCustomer.email);
  assert.strictEqual(verifiedData.user.customerId, verifiedCustomer.customerId);
  assert.ok(verifiedRes.cookies._cookies.has('goodpets_session'), 'Successful sign-in must set goodpets_session cookie');
  console.log('[PASS] Test 3: Verified CUSTOMER signs in successfully (HTTP 200 + session cookie)');

  // ---------------------------------------------------------------------------
  // Test 4: FRONT_DESK account can sign in without customer email verification
  // ---------------------------------------------------------------------------
  const frontDeskReq = createMockRequest({
    email: frontDeskStaff.email,
    password: testPassword,
  });
  const frontDeskRes = await signinRoute.POST(frontDeskReq);
  const frontDeskData = await frontDeskRes.json();

  assert.strictEqual(frontDeskRes.status, 200, 'Staff FRONT_DESK sign-in must return HTTP 200');
  assert.strictEqual(frontDeskData.success, true);
  assert.strictEqual(frontDeskData.user.role, 'FRONT_DESK');
  assert.ok(frontDeskRes.cookies._cookies.has('goodpets_session'));
  console.log('[PASS] Test 4: FRONT_DESK account signs in without customer email verification');

  // ---------------------------------------------------------------------------
  // Test 5: MANAGER account can sign in without customer email verification
  // ---------------------------------------------------------------------------
  const managerReq = createMockRequest({
    email: managerStaff.email,
    password: testPassword,
  });
  const managerRes = await signinRoute.POST(managerReq);
  const managerData = await managerRes.json();

  assert.strictEqual(managerRes.status, 200, 'Staff MANAGER sign-in must return HTTP 200');
  assert.strictEqual(managerData.success, true);
  assert.strictEqual(managerData.user.role, 'MANAGER');
  assert.ok(managerRes.cookies._cookies.has('goodpets_session'));
  console.log('[PASS] Test 5: MANAGER account signs in without customer email verification');

  // ---------------------------------------------------------------------------
  // Test 6: An existing session for an unverified CUSTOMER is rejected by requireUser()
  // ---------------------------------------------------------------------------
  // Forged or pre-existing session token referencing an unverified customer
  const unverifiedSessionToken = signSessionToken({
    userId: unverifiedCustomer.id,
    customerId: unverifiedCustomer.customerId,
    role: 'CUSTOMER',
    sessionVersion: 1,
    exp: Date.now() + 60000,
  });

  currentCookieToken = unverifiedSessionToken;
  const requireUnverifiedResult = await requireUser();
  assert.strictEqual(
    requireUnverifiedResult,
    null,
    'requireUser() must return null for session belonging to an unverified CUSTOMER'
  );
  console.log('[PASS] Test 6: Existing session for an unverified CUSTOMER is rejected by requireUser()');

  // ---------------------------------------------------------------------------
  // Test 7: An unverified CUSTOMER cannot access a protected customer API
  // ---------------------------------------------------------------------------
  // Call /api/auth/me with unverified session cookie
  currentCookieToken = unverifiedSessionToken;
  const meResUnverified = await meRoute.GET();
  const meDataUnverified = await meResUnverified.json();
  assert.strictEqual(meDataUnverified.authenticated, false, 'GET /api/auth/me must return authenticated: false for unverified customer');
  assert.strictEqual(meDataUnverified.user, null);

  // Call /api/pets with unverified session cookie
  const petsResUnverified = await petsRoute.GET();
  assert.strictEqual(petsResUnverified.status, 401, 'GET /api/pets must return HTTP 401 for unverified customer');

  // Call /api/bookings with unverified session cookie
  const bookingsReqUnverified = createMockRequest({ idempotencyKey: 'test-key-1' });
  const bookingsResUnverified = await bookingsRoute.POST(bookingsReqUnverified);
  assert.strictEqual(bookingsResUnverified.status, 401, 'POST /api/bookings must return HTTP 401 for unverified customer');
  console.log('[PASS] Test 7: Unverified CUSTOMER cannot access protected customer APIs (/api/auth/me, /api/pets, /api/bookings)');

  // ---------------------------------------------------------------------------
  // Test 8: A verified CUSTOMER retains access to protected customer features
  // ---------------------------------------------------------------------------
  const verifiedSessionToken = signSessionToken({
    userId: verifiedCustomer.id,
    customerId: verifiedCustomer.customerId,
    role: 'CUSTOMER',
    sessionVersion: 1,
    exp: Date.now() + 60000,
  });

  currentCookieToken = verifiedSessionToken;
  const requireVerifiedResult = await requireUser();
  assert.ok(requireVerifiedResult !== null, 'requireUser() must return user for verified customer');
  assert.strictEqual(requireVerifiedResult.id, verifiedCustomer.id);
  assert.strictEqual(requireVerifiedResult.role, 'CUSTOMER');

  const meResVerified = await meRoute.GET();
  const meDataVerified = await meResVerified.json();
  assert.strictEqual(meDataVerified.authenticated, true);
  assert.strictEqual(meDataVerified.user.id, verifiedCustomer.id);
  console.log('[PASS] Test 8: Verified CUSTOMER retains access to protected customer features');

  // ---------------------------------------------------------------------------
  // Test 9: Existing role-based authorization remains enforced
  // ---------------------------------------------------------------------------
  const frontDeskSessionToken = signSessionToken({
    userId: frontDeskStaff.id,
    customerId: null,
    role: 'FRONT_DESK',
    sessionVersion: 1,
    exp: Date.now() + 60000,
  });

  currentCookieToken = frontDeskSessionToken;

  // Front desk allowed when FRONT_DESK or staff allowed
  const staffAllowed = await requireUser(['FRONT_DESK', 'MANAGER']);
  assert.ok(staffAllowed !== null);
  assert.strictEqual(staffAllowed.role, 'FRONT_DESK');

  // Front desk denied on manager-only route
  const managerOnly = await requireUser(['MANAGER']);
  assert.strictEqual(managerOnly, null, 'FRONT_DESK session must be rejected on manager-only action');

  // Front desk denied on customer-only route
  const customerOnly = await requireUser(['CUSTOMER']);
  assert.strictEqual(customerOnly, null, 'FRONT_DESK session must be rejected on customer-only action');
  console.log('[PASS] Test 9: Existing role-based authorization remains enforced for staff roles');

  // ---------------------------------------------------------------------------
  // Test 10: Existing customer ID behaviour is unchanged
  // ---------------------------------------------------------------------------
  // 10a: CUSTOMER missing customerId
  const missingIdReq = createMockRequest({
    email: verifiedCustomer.email,
    password: testPassword,
  });
  const missingIdRes = await signinRoute.POST(missingIdReq);
  const missingIdData = await missingIdRes.json();
  assert.strictEqual(missingIdRes.status, 401);
  assert.strictEqual(missingIdData.error, 'Invalid Customer ID or password.');

  // 10b: CUSTOMER wrong customerId
  const wrongIdReq = createMockRequest({
    email: verifiedCustomer.email,
    customerId: '9999',
    password: testPassword,
  });
  const wrongIdRes = await signinRoute.POST(wrongIdReq);
  const wrongIdData = await wrongIdRes.json();
  assert.strictEqual(wrongIdRes.status, 401);
  assert.strictEqual(wrongIdData.error, 'Invalid Customer ID or password.');

  // 10c: Staff does not require customerId
  const staffWithoutIdReq = createMockRequest({
    email: managerStaff.email,
    password: testPassword,
  });
  const staffWithoutIdRes = await signinRoute.POST(staffWithoutIdReq);
  assert.strictEqual(staffWithoutIdRes.status, 200, 'Staff does not require Customer ID to sign in');
  console.log('[PASS] Test 10: Existing Customer ID validation behaviour is unchanged');

  console.log('\nAll 10 Stage 5 verification checks passed successfully!\n');
}

main().catch((err) => {
  console.error('[TEST SUITE FAILURE]', err);
  process.exit(1);
});
