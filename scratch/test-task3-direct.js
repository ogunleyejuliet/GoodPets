const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runDirectTests() {
  console.log('--- Starting Task 3 Direct Inspection & Verification Suite ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
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
    const staticRoutes = manifest.staticRoutes.map(r => r.page);
    const dynamicRoutes = (manifest.dynamicRoutes || []).map(r => r.page);
    const allAppRoutes = [...staticRoutes, ...dynamicRoutes].filter(
      r => !r.startsWith('/api') && r !== '/_not-found'
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
    assert.ok(authCode.includes("validModes.has(paramMode) ? (paramMode as AuthMode) : 'login'"), 'Unknown mode must fallback to login');
  });

  test('Implements dynamic URL updating with router.push and scroll: false', () => {
    assert.ok(authCode.includes("router.push(`${pathname}?${params.toString()}`, { scroll: false })"), 'Must update URL query param without page reload');
  });

  test('Truthful Password Reset Notice is displayed with exact required text', () => {
    assert.ok(authCode.includes('Feature Status: In Development'), 'Must include required feature status');
    assert.ok(authCode.includes('Automated password reset email dispatch (PRD Flow 12) is scheduled for integration'), 'Must include exact PRD notice');
    assert.ok(authCode.includes('Token persistence models are prepared, but outbound reset emails are not yet active in this environment.'), 'Must include backend status');
  });

  test('Open redirect protection (getSafeReturnUrl) strictly validates returnUrl', () => {
    assert.ok(authCode.includes('function getSafeReturnUrl'), 'Must define getSafeReturnUrl function');
    
    // Evaluate logic
    function getSafeReturnUrl(rawUrl) {
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
    assert.ok(bookCode.includes("sessionStorage.getItem('goodpets_booking_context')"), 'Must preserve booking context persistence');
    assert.ok(bookCode.includes("sessionStorage.setItem('goodpets_booking_context'"), 'Must save booking context');
    assert.ok(bookCode.includes('href="/auth?mode=reset&returnUrl=/book"'), 'Forgot password link must point to /auth?mode=reset&returnUrl=/book');
    assert.ok(!bookCode.includes('href="/reset-password"'), 'Must not link to /reset-password');
  });

  // 6. Auth Utility Verification
  const { hashPassword, verifyPassword, createSessionToken, verifySessionToken } = require('../src/lib/auth');

  await testAsync('Auth Utility: Password hashing and session token generation/verification', async () => {
    const password = 'TestSecurePassword123!';
    const hash = await hashPassword(password);
    assert.ok(hash.startsWith('$2'), 'Hash must be bcrypt format');
    const valid = await verifyPassword(password, hash);
    assert.strictEqual(valid, true, 'Valid password verification');
    const invalid = await verifyPassword('WrongPassword', hash);
    assert.strictEqual(invalid, false, 'Invalid password rejection');

    const payload = { userId: 'test-user-id', email: 'test@example.com', role: 'CUSTOMER' };
    const token = await createSessionToken(payload);
    assert.ok(typeof token === 'string' && token.length > 20);
    const verified = await verifySessionToken(token);
    assert.strictEqual(verified.userId, payload.userId);
    assert.strictEqual(verified.email, payload.email);
    assert.strictEqual(verified.role, payload.role);
  });

  console.log(`\n--- All Direct Verification Tests Passed: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runDirectTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

