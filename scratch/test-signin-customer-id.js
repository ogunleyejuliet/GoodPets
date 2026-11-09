const assert = require('assert');
const { hash, verify } = require('@node-rs/argon2');

console.log('=== GoodPets: Sign-in Customer ID Enforcement Tests ===\n');

// Argon2id options matching production
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$WJ1l8aV9qEHzLg1h1vY6sC3bQ4qX5zW6yA7bC8dE9f0';

/**
 * Pure simulation of the sign-in authentication flow from src/app/api/auth/signin/route.ts
 */
async function simulateSignIn({ body, mockUser }) {
  const { email, customerId, password } = body;

  // 1. Basic validation
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { status: 400, body: { success: false, error: 'Please enter a valid email address.' } };
  }

  if (!password || typeof password !== 'string') {
    return { status: 400, body: { success: false, error: 'Password is required.' } };
  }

  const normalizedPassword = password.trim();
  const normalizedEmail = email.trim().toLowerCase();

  // 2. Query user from database (simulated)
  const user = mockUser && mockUser.email === normalizedEmail ? mockUser : null;

  if (!user || !user.passwordHash) {
    await verify(DUMMY_ARGON2_HASH, normalizedPassword).catch(() => false);
    return { status: 401, body: { success: false, error: 'Invalid Customer ID or password.' } };
  }

  // 3. For customers, require a valid 4-digit Customer ID matching the account
  if (user.role === 'CUSTOMER') {
    const isFormatValid =
      typeof customerId === 'string' && /^\d{4}$/.test(customerId.trim());
    const isMatch =
      isFormatValid &&
      Boolean(user.customerId) &&
      user.customerId === customerId.trim();

    if (!isMatch) {
      await verify(DUMMY_ARGON2_HASH, normalizedPassword).catch(() => false);
      return { status: 401, body: { success: false, error: 'Invalid Customer ID or password.' } };
    }
  }

  // 4. Verify Argon2id password hash
  const isValid = await verify(user.passwordHash, normalizedPassword);
  if (!isValid) {
    return { status: 401, body: { success: false, error: 'Invalid Customer ID or password.' } };
  }

  // 5. Verify account active state
  if (!user.isActive) {
    return { status: 403, body: { success: false, error: 'Account is deactivated. Please contact support.' } };
  }

  // 6. Success
  return {
    status: 200,
    body: {
      success: true,
      user: {
        id: user.id,
        customerId: user.customerId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  };
}

async function runTests() {
  const customerPassword = 'ValidPassword123!';
  const customerPasswordHash = await hash(customerPassword, ARGON2_OPTIONS);

  const mockCustomer = {
    id: 'cuid_cust_1',
    customerId: '4821',
    email: 'customer@example.com',
    name: 'Ada Obi',
    passwordHash: customerPasswordHash,
    role: 'CUSTOMER',
    isActive: true,
    sessionVersion: 1,
  };

  const mockStaff = {
    id: 'cuid_staff_1',
    customerId: null,
    email: 'manager@goodpets.ng',
    name: 'Manager Kunle',
    passwordHash: customerPasswordHash,
    role: 'MANAGER',
    isActive: true,
    sessionVersion: 1,
  };

  // Test 1: Missing customerId on customer account
  console.log('Test 1: Missing customerId for customer');
  for (const missingVal of [undefined, null, '', '   ']) {
    const res = await simulateSignIn({
      body: {
        email: 'customer@example.com',
        customerId: missingVal,
        password: customerPassword,
      },
      mockUser: mockCustomer,
    });
    assert.strictEqual(res.status, 401, `Missing customerId (${missingVal}) must return HTTP 401`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Invalid Customer ID or password.');
  }
  console.log('  [PASS] Missing customerId rejected with HTTP 401 and generic error');

  // Test 2: Invalid customerId format
  console.log('Test 2: Invalid customerId format');
  const invalidFormats = ['12', '123', '12345', 'abcd', '12a4', '!@#$', 1234, {}, []];
  for (const badFormat of invalidFormats) {
    const res = await simulateSignIn({
      body: {
        email: 'customer@example.com',
        customerId: badFormat,
        password: customerPassword,
      },
      mockUser: mockCustomer,
    });
    assert.strictEqual(res.status, 401, `Invalid format (${JSON.stringify(badFormat)}) must return HTTP 401`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Invalid Customer ID or password.');
  }
  console.log('  [PASS] Malformed customerId rejected with HTTP 401 and generic error');

  // Test 3: Incorrect customerId (4-digit format, but does not match account)
  console.log('Test 3: Incorrect customerId');
  const resWrongId = await simulateSignIn({
    body: {
      email: 'customer@example.com',
      customerId: '9999', // Correct format, wrong value (account is 4821)
      password: customerPassword,
    },
    mockUser: mockCustomer,
  });
  assert.strictEqual(resWrongId.status, 401);
  assert.strictEqual(resWrongId.body.success, false);
  assert.strictEqual(resWrongId.body.error, 'Invalid Customer ID or password.');
  console.log('  [PASS] Incorrect customerId rejected with HTTP 401 and generic error');

  // Test 4: Correct customerId with correct password
  console.log('Test 4: Correct customerId and password');
  const resSuccess = await simulateSignIn({
    body: {
      email: 'customer@example.com',
      customerId: '4821',
      password: customerPassword,
    },
    mockUser: mockCustomer,
  });
  assert.strictEqual(resSuccess.status, 200);
  assert.strictEqual(resSuccess.body.success, true);
  assert.strictEqual(resSuccess.body.user.customerId, '4821');
  assert.strictEqual(resSuccess.body.user.email, 'customer@example.com');
  console.log('  [PASS] Correct customerId accepted with HTTP 200 and valid user payload');

  // Test 5: Correct customerId with leading/trailing whitespace (e.g. ' 4821 ')
  console.log('Test 5: Trimmed customerId handling');
  const resTrimmed = await simulateSignIn({
    body: {
      email: 'customer@example.com',
      customerId: ' 4821 ',
      password: customerPassword,
    },
    mockUser: mockCustomer,
  });
  assert.strictEqual(resTrimmed.status, 200);
  assert.strictEqual(resTrimmed.body.success, true);
  console.log('  [PASS] Trimmed customerId accepted');

  // Test 6: Correct customerId but incorrect password
  console.log('Test 6: Correct customerId with incorrect password');
  const resBadPw = await simulateSignIn({
    body: {
      email: 'customer@example.com',
      customerId: '4821',
      password: 'WrongPassword999!',
    },
    mockUser: mockCustomer,
  });
  assert.strictEqual(resBadPw.status, 401);
  assert.strictEqual(resBadPw.body.success, false);
  assert.strictEqual(resBadPw.body.error, 'Invalid Customer ID or password.');
  console.log('  [PASS] Wrong password rejected with HTTP 401 and generic error');

  // Test 7: Non-customer (Manager / Staff) without customerId
  console.log('Test 7: Staff sign-in without customerId');
  const resStaff = await simulateSignIn({
    body: {
      email: 'manager@goodpets.ng',
      password: customerPassword,
    },
    mockUser: mockStaff,
  });
  assert.strictEqual(resStaff.status, 200);
  assert.strictEqual(resStaff.body.success, true);
  assert.strictEqual(resStaff.body.user.role, 'MANAGER');
  assert.strictEqual(resStaff.body.user.customerId, null);
  console.log('  [PASS] Staff signs in without customerId successfully');

  // Test 8: Non-existent user email
  console.log('Test 8: Non-existent user email');
  const resNoUser = await simulateSignIn({
    body: {
      email: 'nonexistent@example.com',
      customerId: '4821',
      password: customerPassword,
    },
    mockUser: null,
  });
  assert.strictEqual(resNoUser.status, 401);
  assert.strictEqual(resNoUser.body.success, false);
  assert.strictEqual(resNoUser.body.error, 'Invalid Customer ID or password.');
  console.log('  [PASS] Non-existent email returns identical HTTP 401 generic error');

  console.log('\nAll 8 sign-in Customer ID enforcement checks passed successfully!');
}

runTests().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});

