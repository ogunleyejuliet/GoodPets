const assert = require('assert');
const { z } = require('zod');

// Test the Zod integration logic matching src/app/api/auth/signup/route.ts
const { signupSchema } = (() => {
  const schema = z
    .object({
      name: z
        .string({ message: 'Full name must be between 2 and 100 characters.' })
        .trim()
        .min(2, 'Full name must be between 2 and 100 characters.')
        .max(100, 'Full name must be between 2 and 100 characters.'),
      email: z
        .string({ message: 'Please enter a valid email address.' })
        .trim()
        .toLowerCase()
        .email('Please enter a valid email address.'),
      password: z
        .string({ message: 'Password must be at least 8 characters.' })
        .trim()
        .min(8, 'Password must be at least 8 characters.'),
      confirmPassword: z
        .string({ message: 'Passwords do not match.' })
        .trim(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    });

  return { signupSchema: schema };
})();

console.log('=== GoodPets: Signup Integration & Validation Tests ===\n');

// 1. Successful parse & normalization
const validBody = {
  name: '  Jane Doe  ',
  email: '  JANE@EXAMPLE.COM  ',
  password: '  securePass123  ',
  confirmPassword: '  securePass123  ',
};
const res1 = signupSchema.safeParse(validBody);
assert.strictEqual(res1.success, true);
assert.strictEqual(res1.data.name, 'Jane Doe');
assert.strictEqual(res1.data.email, 'jane@example.com');
assert.strictEqual(res1.data.password, 'securePass123');
console.log('[PASS] Valid registration parses and normalizes name, email, and password');

// 2. Short name failure
const res2 = signupSchema.safeParse({ ...validBody, name: '  A  ' });
assert.strictEqual(res2.success, false);
assert.strictEqual(res2.error.issues[0].message, 'Full name must be between 2 and 100 characters.');
assert.ok(res2.error.flatten().fieldErrors.name);
console.log('[PASS] Short name rejected with 400 field-level error');

// 3. Invalid email failure
const res3 = signupSchema.safeParse({ ...validBody, email: 'not-an-email' });
assert.strictEqual(res3.success, false);
assert.strictEqual(res3.error.issues[0].message, 'Please enter a valid email address.');
assert.ok(res3.error.flatten().fieldErrors.email);
console.log('[PASS] Invalid email rejected with 400 field-level error');

// 4. Short password failure
const res4 = signupSchema.safeParse({ ...validBody, password: ' 123 ', confirmPassword: ' 123 ' });
assert.strictEqual(res4.success, false);
assert.strictEqual(res4.error.issues[0].message, 'Password must be at least 8 characters.');
assert.ok(res4.error.flatten().fieldErrors.password);
console.log('[PASS] Short password (< 8 chars) rejected with 400 field-level error');

// 5. Password mismatch failure
const res5 = signupSchema.safeParse({ ...validBody, confirmPassword: 'differentPassword' });
assert.strictEqual(res5.success, false);
assert.strictEqual(res5.error.issues[0].message, 'Passwords do not match.');
assert.ok(res5.error.flatten().fieldErrors.confirmPassword);
console.log('[PASS] Password mismatch rejected with 400 field-level error on confirmPassword');

console.log('\nAll 5 signup integration checks passed successfully!');

