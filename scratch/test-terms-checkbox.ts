import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTermsCheckboxTests() {
  console.log('--- Starting Terms & Conditions Acceptance Checkbox Test Suite ---');
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

  // 1. Inspect public/terms.html
  test('public/terms.html exists and contains comprehensive terms content', () => {
    const termsPath = path.join(process.cwd(), 'public', 'terms.html');
    assert.ok(fs.existsSync(termsPath), 'public/terms.html must exist');
    const html = fs.readFileSync(termsPath, 'utf8');
    assert.ok(html.includes('Terms and Conditions'), 'Must have Terms and Conditions title');
    assert.ok(html.includes('Good Pets'), 'Must mention Good Pets');
    assert.ok(html.includes('Strict No-Refunds Policy'), 'Must mention strict no-refunds policy');
    assert.ok(html.includes('Rescheduling Window'), 'Must mention rescheduling window');
    assert.ok(html.includes('Victoria Island, Lagos'), 'Must mention Victoria Island, Lagos location');
  });

  // 2. Inspect next.config.js rewrite
  test('next.config.js routes /terms to /terms.html', () => {
    const configPath = path.join(process.cwd(), 'next.config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    assert.ok(configContent.includes("source: '/terms'"), "Must rewrite source '/terms'");
    assert.ok(configContent.includes("destination: '/terms.html'"), "Must rewrite destination '/terms.html'");
  });

  // 3. Inspect src/app/auth/page.tsx
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'auth', 'page.tsx'), 'utf8');

  test('Auth page has default unchecked state for terms checkbox', () => {
    assert.ok(
      authCode.includes('const [signUpAgreeToTerms, setSignUpAgreeToTerms] = useState(false);'),
      'signUpAgreeToTerms must be initialized to false'
    );
  });

  test('Auth page contains terms checkbox input with accessible attributes and keyboard accessibility', () => {
    assert.ok(authCode.includes('id="auth-signup-terms"'), 'Checkbox must have id="auth-signup-terms"');
    assert.ok(authCode.includes('type="checkbox"'), 'Input must have type="checkbox"');
    assert.ok(authCode.includes('checked={signUpAgreeToTerms}'), 'Must bind checked to signUpAgreeToTerms');
    assert.ok(authCode.includes('aria-invalid={!!signUpErrors.terms}'), 'Must specify aria-invalid');
    assert.ok(authCode.includes("aria-describedby={signUpErrors.terms ? 'auth-signup-terms-error' : undefined}"), 'Must associate error via aria-describedby');
    assert.ok(authCode.includes('focus:ring-2 focus:ring-primary'), 'Must include keyboard focus ring');
  });

  test('Auth page label contains exact text "I agree to the Terms and Conditions." with clickable link', () => {
    assert.ok(authCode.includes('htmlFor="auth-signup-terms"'), 'Label must link to checkbox via htmlFor');
    assert.ok(authCode.includes('I agree to the'), 'Label must contain text "I agree to the"');
    assert.ok(authCode.includes('href="/terms"'), 'Must link to /terms');
    assert.ok(authCode.includes('Terms and Conditions'), 'Link text must be "Terms and Conditions"');
    assert.ok(authCode.includes('target="_blank"'), 'Must open in new tab so user does not lose signup progress');
    assert.ok(authCode.includes('rel="noopener noreferrer"'), 'Must include rel="noopener noreferrer" for security');
  });

  test('Auth page validation enforces terms acceptance before account creation', () => {
    assert.ok(
      authCode.includes('if (!signUpAgreeToTerms) {'),
      'Must check !signUpAgreeToTerms in handleSignUpSubmit'
    );
    assert.ok(
      authCode.includes("errors.terms = 'You must agree to the Terms and Conditions to create an account.';"),
      'Must set clear terms error message'
    );
  });

  test('Auth page renders accessible error message associated with checkbox', () => {
    assert.ok(authCode.includes('id="auth-signup-terms-error"'), 'Error element must have matching id');
    assert.ok(authCode.includes('role="alert"'), 'Error element must have role="alert"');
    assert.ok(authCode.includes('text-error'), 'Must use semantic design token text-error');
  });

  test('Auth page places checkbox below password fields and above Create Account button', () => {
    const confirmPasswordIdx = authCode.indexOf('id="auth-signup-confirm-password"');
    const termsCheckboxIdx = authCode.indexOf('id="auth-signup-terms"');
    const submitButtonIdx = authCode.indexOf('Creating account...');

    assert.ok(confirmPasswordIdx !== -1, 'Confirm password field must exist');
    assert.ok(termsCheckboxIdx !== -1, 'Terms checkbox must exist');
    assert.ok(submitButtonIdx !== -1, 'Submit button must exist');

    assert.ok(confirmPasswordIdx < termsCheckboxIdx, 'Checkbox must be below password confirmation');
    assert.ok(termsCheckboxIdx < submitButtonIdx, 'Checkbox must be above submit button');
  });

  // 4. Inspect src/app/book/page.tsx
  const bookCode = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'book', 'page.tsx'), 'utf8');

  test('Booking flow Step 3 also contains terms checkbox and validation', () => {
    assert.ok(bookCode.includes('id="book-signup-terms"'), 'Booking page must have id="book-signup-terms"');
    assert.ok(bookCode.includes('href="/terms"'), 'Booking page must link to /terms');
    assert.ok(bookCode.includes('Terms and Conditions'), 'Booking page link text must be "Terms and Conditions"');
    assert.ok(bookCode.includes('id="book-signup-terms-error"'), 'Booking page error must have role and id');
    assert.ok(bookCode.includes('if (!signUpAgreeToTerms) {'), 'Booking page must validate terms acceptance');
  });

  console.log(`\n--- Terms Checkbox Tests Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runTermsCheckboxTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

