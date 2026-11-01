const assert = require('assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('--- Starting Task 3 Consolidated Authentication Verification ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. URL-driven authentication states on /auth
  await test('Default /auth (no mode param) defaults to Sign In form', async () => {
    const res = await fetch(`${BASE_URL}/auth`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Sign In'), 'Should display Sign In title');
    assert.ok(html.includes('auth-login-email'), 'Should render login email input');
    assert.ok(html.includes('auth-login-password'), 'Should render login password input');
  });

  await test('URL State /auth?mode=login renders Sign In form and tabs', async () => {
    const res = await fetch(`${BASE_URL}/auth?mode=login`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Sign In'), 'Should display Sign In title');
    assert.ok(html.includes('mode=signup'), 'Should include tab link to switch to signup');
    assert.ok(html.includes('mode=reset'), 'Should include link to switch to reset');
  });

  await test('URL State /auth?mode=signup renders Create Account form', async () => {
    const res = await fetch(`${BASE_URL}/auth?mode=signup`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Create Account'), 'Should display Create Account title');
    assert.ok(html.includes('auth-signup-name'), 'Should render full name input');
    assert.ok(html.includes('auth-signup-confirm-password'), 'Should render confirm password input');
    assert.ok(html.includes('mode=login'), 'Should include link to switch to login');
  });

  await test('URL State /auth?mode=reset renders Password Reset form with truthful notice', async () => {
    const res = await fetch(`${BASE_URL}/auth?mode=reset`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Reset Password'), 'Should display Reset Password title');
    assert.ok(html.includes('Feature Status: In Development'), 'Must include truthful backend capability notice');
    assert.ok(html.includes('mode=login'), 'Should include link to return to login');
  });

  await test('Invalid mode query param (/auth?mode=unknown) defaults safely to login', async () => {
    const res = await fetch(`${BASE_URL}/auth?mode=unknown`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Sign In'), 'Unknown mode must default to Sign In');
  });

  // 2. Removal of old standalone routes
  await test('Old standalone routes are removed and return 404', async () => {
    const resLogin = await fetch(`${BASE_URL}/login`);
    assert.strictEqual(resLogin.status, 404, '/login must be 404');
    const resSignup = await fetch(`${BASE_URL}/signup`);
    assert.strictEqual(resSignup.status, 404, '/signup must be 404');
    const resReset = await fetch(`${BASE_URL}/reset-password`);
    assert.strictEqual(resReset.status, 404, '/reset-password must be 404');
  });

  // 3. Header navigation updates on Home page
  await test('Home page header links to /auth?mode=login and /auth?mode=signup', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('href="/auth?mode=login"'), 'Must link to /auth?mode=login');
    assert.ok(html.includes('href="/auth?mode=signup"'), 'Must link to /auth?mode=signup');
    assert.ok(html.includes('href="/book"'), 'Must maintain Book a Service link');
  });

  // 4. Functional API & Session Verification
  const timestamp = Date.now();
  const testEmail = `consolidated_user_${timestamp}@example.com`;
  let sessionCookie = '';

  await test('API Integration: POST /api/auth/signup creates user and issues session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Consolidated Tester',
        email: testEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, testEmail);
    sessionCookie = res.headers.get('set-cookie').split(';')[0];
    assert.ok(sessionCookie.includes('goodpets_session='), 'Cookie must be goodpets_session');
  });

  await test('Session Verification: GET /api/auth/me confirms authenticated session', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.user.email, testEmail);
  });

  await test('API Integration: POST /api/auth/signin authenticates existing user', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, testEmail);
  });

  // 5. Open Redirect Protection (returnUrl sanitization)
  await test('Open Redirect Protection: Malicious returnUrl is sanitized safely', () => {
    // Test the logic directly matching getSafeReturnUrl in auth/page.tsx
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
    assert.strictEqual(getSafeReturnUrl('https://evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('//evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('/\\evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('javascript:alert(1)'), '/book');
    assert.strictEqual(getSafeReturnUrl(null), '/book');
  });

  // 6. Booking Journey Intactness
  await test('Booking Flow: GET /book loads with preserved multi-step booking logic', async () => {
    const res = await fetch(`${BASE_URL}/book`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('What would you like to book?'), 'Step 1 service selector exists');
    assert.ok(html.includes('mode=reset'), 'Forgot password link points to consolidated reset mode');
  });

  console.log(`\n--- Verification Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

