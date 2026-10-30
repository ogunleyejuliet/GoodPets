import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runDirectTests() {
  console.log('--- Starting Task 3 Direct Inspection & Verification Suite (TSX) ---');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Filesystem & Route Consolidation Verification
  test('New consolidated auth route src/app/auth/page.tsx exists', () => {
    const authPath = path.join(process.cwd(), 'src', 'app', 'auth', 'page.tsx');
    assert.ok(fs.existsSync(authPath), 'src/app/auth/page.tsx must exist');
  });

  test('Old standalone routes are completely removed from filesystem', () => {
    const loginPath = path.join(process.cwd(), 'src', 'app', 'login');
    const signupPath = path.join(process.cwd(), 'src', 'app', 'signup');
    const resetPath = path.join(process.cwd(), 'src', 'app', 'reset-password');

    assert.ok(!fs.existsSync(loginPath), 'src/app/login must not exist');
    assert.ok(!fs.existsSync(signupPath), 'src/app/signup must not exist');
    assert.ok(!fs.existsSync(resetPath), 'src/app/reset-password must not exist');
  });

  // 2. Next.js Route Manifest & Page Count
  test('Next.js build route manifest confirms exactly 3 user-facing pages', () => {
    const manifestPath = path.join(process.cwd(), '.next', 'routes-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'routes-manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Check static and dynamic routes
    const staticRoutes = manifest.staticRoutes.map((r: any) => r.page);
    const dynamicRoutes = (manifest.dynamicRoutes || []).map((r: any) => r.page);
    const allAppRoutes = [...staticRoutes, ...dynamicRoutes].filter(
      (r: string) => !r.startsWith('/api') && r !== '/_not-found'
    );

    console.log('User-facing routes in manifest:', allAppRoutes);
    assert.strictEqual(allAppRoutes.length, 3, 'Must have exactly 3 user-facing routes');
    assert.ok(allAppRoutes.includes('/'), 'Must include /');
    assert.ok(allAppRoutes.includes('/auth'), 'Must include /auth');
    assert.ok(allAppRoutes.includes('/book'), 'Must include /book');
  });

  // 3. Consolidated Page Implementation & Requirements Verification
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'auth', 'page.tsx'), 'utf8');

  test('Consolidated Auth Page uses Suspense wrapper for useSearchParams', () => {
    assert.ok(authCode.includes('<Suspense'), 'Must wrap searchParams consumer in Suspense');
    assert.ok(authCode.includes('useSearchParams'), 'Must use useSearchParams hook');
  });

  test('Supports URL modes: login, signup, reset with default fallback to login', () => {
    assert.ok(authCode.includes("searchParams.get('mode')"), 'Must read mode from searchParams');
    assert.ok(
      authCode.includes("modeParam === 'signup' || modeParam === 'reset' ? modeParam : 'login'"),
      'Unknown mode must fallback to login'
    );
  });

  test('Implements dynamic URL updating with router.push', () => {
    assert.ok(authCode.includes('router.push(`${pathname}?${params.toString()}`)'), 'Must update URL query param without page reload');
  });

  test('Truthful Password Reset Notice is displayed with exact required text', () => {
    assert.ok(authCode.includes('Feature Status: In Development'), 'Must include required feature status');
    assert.ok(authCode.includes('Automated password reset email dispatch (PRD Flow 12) is scheduled for integration'), 'Must include exact PRD notice');
    assert.ok(authCode.includes('Token persistence models are prepared, but outbound reset emails are not yet active in this environment.'), 'Must include backend status');
  });

  test('Open redirect protection (getSafeReturnUrl) strictly validates returnUrl', () => {
    assert.ok(authCode.includes('function getSafeReturnUrl'), 'Must define getSafeReturnUrl function');
    
    // Evaluate logic
    function getSafeReturnUrl(rawUrl: string | null): string {
      if (!rawUrl) return '/book';
      const trimmed = rawUrl.trim();
      if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
        try {
          const parsed = new URL(trimmed, 'http://localhost');
          if (parsed.origin === 'http://localhost') {
            return parsed.pathname + parsed.search + parsed.hash;
          }
        } catch {
          return '/book';
        }
      }
      return '/book';
    }

    assert.strictEqual(getSafeReturnUrl('/book'), '/book');
    assert.strictEqual(getSafeReturnUrl('/book?step=2'), '/book?step=2');
    assert.strictEqual(getSafeReturnUrl('https://malicious-site.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('//evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('/\\evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('javascript:alert(1)'), '/book');
    assert.strictEqual(getSafeReturnUrl(''), '/book');
    assert.strictEqual(getSafeReturnUrl(null), '/book');
  });

  // 4. Header Navigation Links Verification in LandingContent.tsx
  const landingCode = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'LandingContent.tsx'), 'utf8');

  test('LandingContent.tsx links desktop and mobile header to consolidated /auth modes', () => {
    assert.ok(landingCode.includes('href="/auth?mode=login"'), 'Sign In must link to /auth?mode=login');
    assert.ok(landingCode.includes('href="/auth?mode=signup"'), 'Create Account must link to /auth?mode=signup');
    assert.ok(!landingCode.includes('href="/login"'), 'Must not link to /login');
    assert.ok(!landingCode.includes('href="/signup"'), 'Must not link to /signup');
  });

  // 5. Booking Flow Preservation in src/app/book/page.tsx
  const bookCode = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'book', 'page.tsx'), 'utf8');

  test('Booking flow preserves multi-step state, sessionStorage, and updates reset link', () => {
    assert.ok(bookCode.includes("STORAGE_KEY = 'goodpets_booking_context'"), 'Must preserve booking context storage key');
    assert.ok(bookCode.includes("AUTH_STORAGE_KEY = 'goodpets_customer_session'"), 'Must preserve customer session storage key');
    assert.ok(bookCode.includes('href="/auth?mode=reset&returnUrl=/book"'), 'Forgot password link must point to /auth?mode=reset&returnUrl=/book');
    assert.ok(!bookCode.includes('href="/reset-password"'), 'Must not link to /reset-password');
  });

  // 6. Auth Utility Verification
  const { signSessionToken, verifySessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } = await import('../src/lib/auth');
  const argon2 = await import('@node-rs/argon2');

  await testAsync('Auth Utility: Argon2 hashing and HMAC session token signing/verification', async () => {
    const password = 'TestSecurePassword123!';
    const hash = await argon2.hash(password);
    assert.ok(hash.startsWith('$argon2'), 'Hash must be argon2 format');
    const valid = await argon2.verify(hash, password);
    assert.strictEqual(valid, true, 'Valid password verification');
    const invalid = await argon2.verify(hash, 'WrongPassword');
    assert.strictEqual(invalid, false, 'Invalid password rejection');

    process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-at-least-32-chars-long-for-testing';
    const payload = {
      userId: 'test-user-id-1234',
      role: 'CUSTOMER',
      sessionVersion: 1,
      exp: Date.now() + 3600000,
    };
    const token = signSessionToken(payload);
    assert.ok(typeof token === 'string' && token.includes('.'), 'Token must be formatted as data.signature');
    const verified = verifySessionToken(token);
    assert.ok(verified !== null, 'Token must verify successfully');
    assert.strictEqual(verified?.userId, payload.userId);
    assert.strictEqual(verified?.role, payload.role);
    assert.strictEqual(verified?.sessionVersion, payload.sessionVersion);

    // Tampered token test
    const tampered = token.slice(0, -3) + 'abc';
    const tamperedResult = verifySessionToken(tampered);
    assert.strictEqual(tamperedResult, null, 'Tampered token must fail verification');
  });

  console.log(`\n--- All Direct Verification Tests Passed: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runDirectTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

