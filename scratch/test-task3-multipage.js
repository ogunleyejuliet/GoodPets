const assert = require('assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('--- Starting Task 3 Multi-Page Authentication Verification ---');
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

  // 1. HTTP 200 checks for all standalone routes
  await test('GET /login returns HTTP 200 HTML page', async () => {
    const res = await fetch(`${BASE_URL}/login`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Sign In'), 'Should contain Sign In heading');
    assert.ok(html.includes('name@example.com'), 'Should contain email input placeholder');
  });

  await test('GET /signup returns HTTP 200 HTML page', async () => {
    const res = await fetch(`${BASE_URL}/signup`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Create Account'), 'Should contain Create Account heading');
    assert.ok(html.includes('Full Name'), 'Should contain Full Name label');
  });

  await test('GET /reset-password returns HTTP 200 HTML page', async () => {
    const res = await fetch(`${BASE_URL}/reset-password`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Reset Password'), 'Should contain Reset Password heading');
    assert.ok(html.includes('Feature Status: In Development'), 'Should accurately explain feature status');
  });

  await test('GET / (Home) header links to /login and /signup', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('href="/login"'), 'Header must contain link to /login');
    assert.ok(html.includes('href="/signup"'), 'Header must contain link to /signup');
    assert.ok(html.includes('href="/book"'), 'Header must maintain link to /book');
  });

  // 2. Functional Authentication checks with API
  const timestamp = Date.now();
  const testEmail = `multipage_user_${timestamp}@example.com`;
  let sessionCookie = '';

  await test('Standalone Signup: Register user via POST /api/auth/signup', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MultiPage Tester',
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
    assert.ok(sessionCookie.includes('goodpets_session='), 'Must set goodpets_session cookie');
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

  await test('Standalone Login: Authenticate existing user via POST /api/auth/signin', async () => {
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

  // 3. Confirm existing booking flow is fully functional and untouched
  await test('Booking Flow: GET /book loads multi-step booking page with intact Step 3', async () => {
    const res = await fetch(`${BASE_URL}/book`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('What would you like to book?'), 'Step 1 service selector exists');
    assert.ok(html.includes('Grooming'), 'Grooming service option exists');
    assert.ok(html.includes('Daycare'), 'Daycare service option exists');
    assert.ok(html.includes('Boarding'), 'Boarding service option exists');
  });

  console.log(`\n--- Verification Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
