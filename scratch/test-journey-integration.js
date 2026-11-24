const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

console.log('=== GoodPets Post-Stage 5: Email Verification Journey Integration & Booking Resumption Tests ===\n');

process.env.AUTH_SECRET = 'super-secret-test-auth-encryption-key-32chars!';
process.env.NODE_ENV = 'test';

const ROOT = path.resolve(__dirname, '..');

// Helper to load and transpile TypeScript modules
function loadTsModule(relPath, customMocks = {}) {
  const fullPath = path.resolve(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });

  const mod = new Module(fullPath);
  mod.filename = fullPath;
  mod.paths = Module._nodeModulePaths(path.dirname(fullPath));

  const originalRequire = mod.require.bind(mod);
  mod.require = (request) => {
    if (Object.prototype.hasOwnProperty.call(customMocks, request)) {
      return customMocks[request];
    }
    if (request.startsWith('@/')) {
      const mappedRel = path.join('src', request.slice(2));
      const mappedTs = path.resolve(ROOT, mappedRel + '.ts');
      const mappedTsx = path.resolve(ROOT, mappedRel + '.tsx');
      if (fs.existsSync(mappedTs)) {
        return loadTsModule(path.relative(ROOT, mappedTs), customMocks);
      }
      if (fs.existsSync(mappedTsx)) {
        return loadTsModule(path.relative(ROOT, mappedTsx), customMocks);
      }
    }
    return originalRequire(request);
  };

  mod._compile(transpiled.outputText, fullPath);
  return mod.exports;
}

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

async function main() {
  console.log('--- Suite 1: Open-Redirect Validation (getSafeReturnUrl) ---');
  const authValidation = loadTsModule('src/lib/auth-validation.ts');
  const { getSafeReturnUrl } = authValidation;

  runTest('1.1: Valid internal root returns /book or exact internal path', () => {
    assert.strictEqual(getSafeReturnUrl('/book'), '/book');
    assert.strictEqual(getSafeReturnUrl('/'), '/');
    assert.strictEqual(getSafeReturnUrl('/auth?mode=login'), '/auth?mode=login');
    assert.strictEqual(getSafeReturnUrl('/book?step=3&service=grooming'), '/book?step=3&service=grooming');
  });

  runTest('1.2: Open-redirect attempts with protocol-relative URLs (//) return default /book', () => {
    assert.strictEqual(getSafeReturnUrl('//evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('//evil.com/phish'), '/book');
    assert.strictEqual(getSafeReturnUrl('///evil.com'), '/book');
  });

  runTest('1.3: Open-redirect attempts with backslash (/\\) return default /book', () => {
    assert.strictEqual(getSafeReturnUrl('/\\evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('/\\/evil.com'), '/book');
  });

  runTest('1.4: Absolute external URLs (http/https) return default /book', () => {
    assert.strictEqual(getSafeReturnUrl('https://evil.com'), '/book');
    assert.strictEqual(getSafeReturnUrl('http://attacker.com/steal'), '/book');
    assert.strictEqual(getSafeReturnUrl('ftp://evil.com'), '/book');
  });

  runTest('1.5: Dangerous schemes (javascript:, data:) return default /book', () => {
    assert.strictEqual(getSafeReturnUrl('javascript:alert(1)'), '/book');
    assert.strictEqual(getSafeReturnUrl('data:text/html,<script>alert(1)</script>'), '/book');
  });

  runTest('1.6: Null, undefined, empty string return default /book', () => {
    assert.strictEqual(getSafeReturnUrl(null), '/book');
    assert.strictEqual(getSafeReturnUrl(undefined), '/book');
    assert.strictEqual(getSafeReturnUrl(''), '/book');
    assert.strictEqual(getSafeReturnUrl('   '), '/book');
  });

  runTest('1.7: Custom defaultUrl is respected when invalid or null', () => {
    assert.strictEqual(getSafeReturnUrl(null, ''), '');
    assert.strictEqual(getSafeReturnUrl('https://evil.com', ''), '');
    assert.strictEqual(getSafeReturnUrl('//evil.com', '/fallback'), '/fallback');
    assert.strictEqual(getSafeReturnUrl('/book?service=boarding', ''), '/book?service=boarding');
  });

  console.log('\n--- Suite 2: Standalone Signup (Flow B) Contracts ---');

  runTest('2.1: Standalone auth page contains confirmation card with registered email & single-use notice', () => {
    const authSource = fs.readFileSync(path.resolve(ROOT, 'src/app/auth/page.tsx'), 'utf8');
    assert(
      authSource.includes('signUpVerificationPending'),
      'Auth page must maintain signUpVerificationPending state'
    );
    assert(
      authSource.includes('Check your email to verify your account'),
      'Auth page must render confirmation heading'
    );
    assert(
      authSource.includes('signUpRegisteredEmail'),
      'Auth page must display the registered email address'
    );
    assert(
      authSource.includes('Verification links are valid for 24 hours') ||
        authSource.includes('Verification links expire in 24 hours'),
      'Auth page must state 24-hour expiration'
    );
    assert(
      authSource.includes('Each link is single-use and invalidates upon verification') ||
        authSource.includes('single-use'),
      'Auth page must explain single-use policy'
    );
    assert(
      authSource.includes('Return to Sign In'),
      'Auth page must provide action to return to sign in'
    );
  });

  runTest('2.2: Standalone signup does NOT save session or immediately redirect upon registration', () => {
    const authSource = fs.readFileSync(path.resolve(ROOT, 'src/app/auth/page.tsx'), 'utf8');
    // Ensure handleSignUpSubmit sets signUpVerificationPending without saving session
    const handleSignUpBlock = authSource.slice(
      authSource.indexOf('handleSignUpSubmit'),
      authSource.indexOf('handleResetSubmit')
    );
    assert(
      !handleSignUpBlock.includes('sessionStorage.setItem(AUTH_STORAGE_KEY'),
      'handleSignUpSubmit must NOT store session in sessionStorage'
    );
    assert(
      !handleSignUpBlock.includes('router.push('),
      'handleSignUpSubmit must NOT auto-redirect to returnUrl'
    );
    assert(
      handleSignUpBlock.includes('setSignUpVerificationPending(true)'),
      'handleSignUpSubmit must set signUpVerificationPending to true'
    );
  });

  runTest('2.3: Standalone login displays unverified email guidance on HTTP 403', () => {
    const authSource = fs.readFileSync(path.resolve(ROOT, 'src/app/auth/page.tsx'), 'utf8');
    assert(
      authSource.includes("res.status === 403 || data.code === 'EMAIL_NOT_VERIFIED'"),
      'handleLoginSubmit must detect unverified status and provide guidance'
    );
    assert(
      authSource.includes('Stage 6'),
      'Login error display must inform that resend will be available in Stage 6'
    );
  });

  console.log('\n--- Suite 3: Booking-Initiated Signup (Flow A) Contracts ---');

  runTest('3.1: Booking page maintains verification pending state without auto-advancing to Step 4', () => {
    const bookSource = fs.readFileSync(path.resolve(ROOT, 'src/app/book/page.tsx'), 'utf8');
    assert(
      bookSource.includes('bookSignUpVerificationPending'),
      'Book page must track bookSignUpVerificationPending'
    );
    const handleSignUpBlock = bookSource.slice(
      bookSource.indexOf('handleSignUp = async'),
      bookSource.indexOf('handleSignOut = async')
    );
    assert(
      !handleSignUpBlock.includes('setStep(4)'),
      'handleSignUp must NOT advance to Step 4'
    );
    assert(
      !handleSignUpBlock.includes('sessionStorage.setItem(AUTH_STORAGE_KEY'),
      'handleSignUp must NOT store session in sessionStorage'
    );
    assert(
      !handleSignUpBlock.includes('setUser(newUser)'),
      'handleSignUp must NOT set authenticated user state'
    );
    assert(
      handleSignUpBlock.includes('setBookSignUpVerificationPending(true)'),
      'handleSignUp must set bookSignUpVerificationPending to true'
    );
  });

  runTest('3.2: Step 3 renders confirmation view explaining selections are saved in browser but capacity is NOT held', () => {
    const bookSource = fs.readFileSync(path.resolve(ROOT, 'src/app/book/page.tsx'), 'utf8');
    assert(
      bookSource.includes('Capacity is not yet reserved'),
      'Step 3 confirmation view must explicitly clarify that capacity is not yet reserved'
    );
    assert(
      bookSource.includes('Your selected service details are saved in this browser window'),
      'Step 3 confirmation view must inform that selections are saved in the browser'
    );
    assert(
      bookSource.includes('Already verified? Sign in here'),
      'Step 3 must provide an inline button to toggle to sign-in'
    );
    assert(
      bookSource.includes('Use a different email address'),
      'Step 3 must allow entering a different email if needed'
    );
  });

  runTest('3.3: Step 3 Sign-in handles 403 EMAIL_NOT_VERIFIED without advancing', () => {
    const bookSource = fs.readFileSync(path.resolve(ROOT, 'src/app/book/page.tsx'), 'utf8');
    const handleSignInBlock = bookSource.slice(
      bookSource.indexOf('handleSignIn = async'),
      bookSource.indexOf('// Validation handlers: Sign Up')
    );
    assert(
      handleSignInBlock.includes("res.status === 403 || data.code === 'EMAIL_NOT_VERIFIED'"),
      'handleSignIn must check for unverified email'
    );
  });

  runTest('3.4: Rehydrating or authenticating on Step 3 automatically advances to Step 4', () => {
    const bookSource = fs.readFileSync(path.resolve(ROOT, 'src/app/book/page.tsx'), 'utf8');
    assert(
      bookSource.includes('if (user && step === 3)'),
      'Booking wizard must advance from Step 3 to Step 4 once user is authenticated'
    );
  });

  console.log('\n--- Suite 4: Verification Page (Flow A & Flow B Navigation) ---');

  runTest('4.1: Verification page extracts returnUrl and validates with getSafeReturnUrl', () => {
    const verifySource = fs.readFileSync(path.resolve(ROOT, 'src/app/auth/verify/page.tsx'), 'utf8');
    assert(
      verifySource.includes("searchParams.get('returnUrl')"),
      'Verify page must inspect returnUrl query parameter'
    );
    assert(
      verifySource.includes('getSafeReturnUrl'),
      'Verify page must cleanse returnUrl with getSafeReturnUrl'
    );
  });

  runTest('4.2: Verification page builds safe sign-in link with returnUrl preserved', () => {
    const verifySource = fs.readFileSync(path.resolve(ROOT, 'src/app/auth/verify/page.tsx'), 'utf8');
    assert(
      verifySource.includes('signInHref'),
      'Verify page must construct signInHref'
    );
    assert(
      verifySource.includes('encodeURIComponent(safeReturnUrl)'),
      'Verify page must safely URI-encode returnUrl'
    );
    assert(
      !verifySource.includes('href="/auth?mode=login"'),
      'Verify page must use dynamic signInHref instead of hardcoded link'
    );
  });

  runTest('4.3: Cross-device verification link without returnUrl defaults signin to /book', () => {
    const safeReturn = getSafeReturnUrl(null);
    assert.strictEqual(safeReturn, '/book', 'Default returnUrl must be /book');
  });

  console.log(`\n========================================`);
  console.log(`Tests completed: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('ALL JOURNEY INTEGRATION TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

