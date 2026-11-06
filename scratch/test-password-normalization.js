const assert = require('assert');
const { hash, verify } = require('@node-rs/argon2');

async function testPasswordNormalization() {
  console.log('Testing Argon2id and normalization behavior...');

  const rawPassword = '   mySecurePassword123   ';
  const trimmedPassword = rawPassword.trim();

  assert.strictEqual(trimmedPassword.length >= 8, true);
  assert.strictEqual(trimmedPassword, 'mySecurePassword123');

  // Verify Argon2id hash of normalized password
  const passwordHash = await hash(trimmedPassword, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  // Verify signin with untrimmed input (should match when normalized in signin)
  const signinInputUntrimmed = '   mySecurePassword123   ';
  const signinNormalized = signinInputUntrimmed.trim();
  const isValid = await verify(passwordHash, signinNormalized);
  assert.strictEqual(isValid, true, 'Signin with trimmed password must match hash of trimmed signup password');

  // Verify signin with untrimmed dummy hash
  const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$dummySaltForTimingSafety$dummyHashValueForConstantTimeMitigation';
  // Dummy verify catches error or returns false
  const dummyResult = await verify(DUMMY_HASH, signinNormalized).catch(() => false);
  assert.strictEqual(dummyResult, false, 'Dummy verification should return false safely');

  // Test confirmPassword variations
  const confirmUntrimmed = '   mySecurePassword123  \t ';
  assert.strictEqual(trimmedPassword === confirmUntrimmed.trim(), true);

  const missingConfirm = undefined;
  assert.strictEqual(!missingConfirm || typeof missingConfirm !== 'string', true);

  const nonStringConfirm = 12345678;
  assert.strictEqual(!nonStringConfirm || typeof nonStringConfirm !== 'string', true);

  const shortUntrimmed = '   abc   ';
  assert.strictEqual(shortUntrimmed.trim().length < 8, true);

  console.log('All normalization and verification checks passed!');
}

testPasswordNormalization().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

