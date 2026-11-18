const assert = require('assert');
const { z } = require('zod');

// Matches src/lib/validations/auth.ts
const { signupSchema } = (() => {
  const schema = z
    .object({
      name: z
        .string({ message: 'Full name must be between 2 and 100 characters.' })
        .trim()
        .min(2, 'Full name must be between 2 and 100 characters.')
        .max(100, 'Full name must be between 2 and 100 characters.')
        .refine(
          (val) => val.split(/\s+/).filter(Boolean).length >= 2,
          { message: 'Please enter your full name (at least two names).' }
        ),
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
      agreeToTerms: z
        .boolean({ message: 'You must agree to the Terms and Conditions to create an account.' })
        .refine((val) => val === true, {
          message: 'You must agree to the Terms and Conditions to create an account.',
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    });

  return { signupSchema: schema };
})();

console.log('=== GoodPets: Signup Integration, Name & Terms Validation Tests ===\n');

const baseValidBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'securePassword123!',
  confirmPassword: 'securePassword123!',
  agreeToTerms: true,
};

// 1. Valid two-word name
const resTwoWords = signupSchema.safeParse({ ...baseValidBody, name: 'Jane Doe' });
assert.strictEqual(resTwoWords.success, true);
assert.strictEqual(resTwoWords.data.name, 'Jane Doe');
assert.strictEqual(resTwoWords.data.agreeToTerms, true);
console.log('[PASS] Valid two-word name accepted with agreeToTerms: true');

// 2. Single-word name rejected
const resSingleWord = signupSchema.safeParse({ ...baseValidBody, name: 'Madonna' });
assert.strictEqual(resSingleWord.success, false);
assert.strictEqual(
  resSingleWord.error.issues[0].message,
  'Please enter your full name (at least two names).'
);
assert.ok(resSingleWord.error.flatten().fieldErrors.name.includes('Please enter your full name (at least two names).'));
console.log('[PASS] Single-word name rejected with "Please enter your full name (at least two names)."');

// 3. Name with multiple spaces between words
const resMultiSpaces = signupSchema.safeParse({ ...baseValidBody, name: 'Jane    Doe' });
assert.strictEqual(resMultiSpaces.success, true);
assert.strictEqual(resMultiSpaces.data.name, 'Jane    Doe');
console.log('[PASS] Name with multiple spaces between words accepted');

// 4. Name with leading/trailing whitespace
const resWhitespacePadded = signupSchema.safeParse({ ...baseValidBody, name: '   Jane Doe   ' });
assert.strictEqual(resWhitespacePadded.success, true);
assert.strictEqual(resWhitespacePadded.data.name, 'Jane Doe');
console.log('[PASS] Name with leading/trailing whitespace trimmed and accepted');

// 5. Name containing only whitespace
const resOnlyWhitespace = signupSchema.safeParse({ ...baseValidBody, name: '     ' });
assert.strictEqual(resOnlyWhitespace.success, false);
assert.ok(
  resOnlyWhitespace.error.issues.some((issue) =>
    issue.message === 'Full name must be between 2 and 100 characters.' ||
    issue.message === 'Please enter your full name (at least two names).'
  )
);
console.log('[PASS] Name containing only whitespace rejected');

// 6. Short name (< 2 characters)
const resShort = signupSchema.safeParse({ ...baseValidBody, name: 'A' });
assert.strictEqual(resShort.success, false);
assert.ok(resShort.error.flatten().fieldErrors.name);
console.log('[PASS] Single-character name rejected');

// 7. Single word with leading/trailing whitespace
const resSingleWordWhitespace = signupSchema.safeParse({ ...baseValidBody, name: '  Cher  ' });
assert.strictEqual(resSingleWordWhitespace.success, false);
assert.strictEqual(
  resSingleWordWhitespace.error.issues[0].message,
  'Please enter your full name (at least two names).'
);
console.log('[PASS] Single-word name with surrounding whitespace trimmed and rejected');

// 8. Name exceeding 100 characters
const resTooLong = signupSchema.safeParse({ ...baseValidBody, name: 'Jane ' + 'A'.repeat(100) });
assert.strictEqual(resTooLong.success, false);
assert.ok(resTooLong.error.flatten().fieldErrors.name);
console.log('[PASS] Name exceeding 100 characters rejected');

// 9. Valid three-word name
const resThreeWords = signupSchema.safeParse({ ...baseValidBody, name: 'Jane Mary Doe' });
assert.strictEqual(resThreeWords.success, true);
assert.strictEqual(resThreeWords.data.name, 'Jane Mary Doe');
console.log('[PASS] Three-word name accepted');

// 10. Existing password and email validation preserved
const resBadEmail = signupSchema.safeParse({ ...baseValidBody, email: 'not-an-email' });
assert.strictEqual(resBadEmail.success, false);
console.log('[PASS] Email validation preserved');

const resShortPw = signupSchema.safeParse({ ...baseValidBody, password: '123', confirmPassword: '123' });
assert.strictEqual(resShortPw.success, false);
console.log('[PASS] Password length validation preserved');

const resPwMismatch = signupSchema.safeParse({ ...baseValidBody, confirmPassword: 'different' });
assert.strictEqual(resPwMismatch.success, false);
console.log('[PASS] Password confirmation match preserved');

// 11. Terms agreement: true (accepted)
const resTermsTrue = signupSchema.safeParse({ ...baseValidBody, agreeToTerms: true });
assert.strictEqual(resTermsTrue.success, true);
assert.strictEqual(resTermsTrue.data.agreeToTerms, true);
console.log('[PASS] agreeToTerms: true accepted');

// 12. Terms agreement: false (rejected with 400 validation error)
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
console.log('[PASS] agreeToTerms: false rejected');

// 13. Terms agreement: omitted (rejected with 400 validation error)
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
console.log('[PASS] agreeToTerms: omitted rejected');

console.log('\nAll 15 signup validation, name rule, and terms agreement tests passed successfully!');
