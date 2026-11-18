import assert from 'node:assert';
import { signupSchema } from '../src/lib/validations/auth.ts';

console.log('=== GoodPets: Direct Validation of src/lib/validations/auth.ts ===\n');

const baseValidBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'securePassword123!',
  confirmPassword: 'securePassword123!',
  agreeToTerms: true,
};

// 1. A valid two-word name.
const res1 = signupSchema.safeParse({ ...baseValidBody, name: 'Jane Doe' });
assert.strictEqual(res1.success, true);
assert.strictEqual(res1.data.name, 'Jane Doe');
console.log('[PASS] 1. Valid two-word name accepted');

// 2. A single-word name.
const res2 = signupSchema.safeParse({ ...baseValidBody, name: 'Madonna' });
assert.strictEqual(res2.success, false);
assert.strictEqual(
  res2.error.issues[0].message,
  'Please enter your full name (at least two names).'
);
console.log('[PASS] 2. Single-word name rejected with "Please enter your full name (at least two names)."');

// 3. A name with multiple spaces between words.
const res3 = signupSchema.safeParse({ ...baseValidBody, name: 'Jane    Doe' });
assert.strictEqual(res3.success, true);
assert.strictEqual(res3.data.name, 'Jane    Doe');
console.log('[PASS] 3. Name with multiple spaces between words accepted');

// 4. A name with leading/trailing whitespace.
const res4 = signupSchema.safeParse({ ...baseValidBody, name: '   Jane Doe   ' });
assert.strictEqual(res4.success, true);
assert.strictEqual(res4.data.name, 'Jane Doe');
console.log('[PASS] 4. Name with leading/trailing whitespace trimmed and accepted');

// 5. A name containing only whitespace.
const res5 = signupSchema.safeParse({ ...baseValidBody, name: '     ' });
assert.strictEqual(res5.success, false);
console.log('[PASS] 5. Name containing only whitespace rejected');

// 6. Terms agreement: true (accepted)
const resTermsTrue = signupSchema.safeParse({ ...baseValidBody, agreeToTerms: true });
assert.strictEqual(resTermsTrue.success, true);
assert.strictEqual(resTermsTrue.data.agreeToTerms, true);
console.log('[PASS] 6. agreeToTerms: true accepted');

// 7. Terms agreement: false (rejected with 400 validation error)
const resTermsFalse = signupSchema.safeParse({ ...baseValidBody, agreeToTerms: false });
assert.strictEqual(resTermsFalse.success, false);
assert.strictEqual(
  resTermsFalse.error.issues[0].message,
  'You must agree to the Terms and Conditions to create an account.'
);
assert.ok(
  resTermsFalse.error.flatten().fieldErrors.agreeToTerms.includes(
    'You must agree to the Terms and Conditions to create an account.'
  )
);
console.log('[PASS] 7. agreeToTerms: false rejected');

// 8. Terms agreement: omitted (rejected with 400 validation error)
const { agreeToTerms, ...bodyWithoutTerms } = baseValidBody;
const resTermsOmitted = signupSchema.safeParse(bodyWithoutTerms);
assert.strictEqual(resTermsOmitted.success, false);
assert.strictEqual(
  resTermsOmitted.error.issues[0].message,
  'You must agree to the Terms and Conditions to create an account.'
);
assert.ok(
  resTermsOmitted.error.flatten().fieldErrors.agreeToTerms.includes(
    'You must agree to the Terms and Conditions to create an account.'
  )
);
console.log('[PASS] 8. agreeToTerms omitted rejected');

console.log('\nAll direct validation checks on src/lib/validations/auth.ts passed successfully!');
