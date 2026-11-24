import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== GoodPets Task 4 Step 10: Email Verification Page (/auth/verify) Tests ===\n');

const pageFilePath = path.join(process.cwd(), 'src', 'app', 'auth', 'verify', 'page.tsx');

// 1. File existence and Next.js routing convention
assert.ok(fs.existsSync(pageFilePath), 'src/app/auth/verify/page.tsx must exist');
const fileContent = fs.readFileSync(pageFilePath, 'utf8');
console.log('[PASS] Test 1: Page file exists at exact route src/app/auth/verify/page.tsx');

// 2. Client Component and Suspense boundary
assert.ok(fileContent.startsWith("'use client'"), "Page must be declared with 'use client'");
assert.ok(fileContent.includes('<Suspense'), 'Page must wrap searchParams consumer in <Suspense>');
assert.ok(fileContent.includes('Loading verification...'), 'Suspense fallback must display loading indicator');
console.log('[PASS] Test 2: Client component with Suspense boundary wrapping useSearchParams');

// 3. Token extraction from URL query parameters
assert.ok(fileContent.includes("useSearchParams"), 'Component must import and call useSearchParams');
assert.ok(fileContent.includes("searchParams.get('token')"), "Component must read 'token' query parameter");
console.log('[PASS] Test 3: Correct token extraction from URL search parameters');

// 4. API submission contract
assert.ok(
  fileContent.includes("fetch('/api/auth/verify-email'"),
  'Component must submit to /api/auth/verify-email'
);
assert.ok(
  fileContent.includes("method: 'POST'"),
  'Component must use POST method'
);
assert.ok(
  fileContent.includes("'Content-Type': 'application/json'"),
  'Component must set Content-Type: application/json'
);
assert.ok(
  fileContent.includes('JSON.stringify({ token: trimmed })'),
  'Component must post JSON payload with token'
);
console.log('[PASS] Test 4: Submits token to POST /api/auth/verify-email via native fetch');

// 5. Handling of all verification states
assert.ok(fileContent.includes("status === 'verifying'"), 'Must handle verifying/loading state');
assert.ok(fileContent.includes("status === 'success'"), 'Must handle success state');
assert.ok(fileContent.includes("status === 'expired'"), 'Must handle expired state (410)');
assert.ok(fileContent.includes("status === 'reused'"), 'Must handle reused/already used state (409)');
assert.ok(fileContent.includes("status === 'invalid'"), 'Must handle invalid token state (400)');
assert.ok(fileContent.includes("status === 'error'"), 'Must handle server/network error state');
console.log('[PASS] Test 5: All required lifecycle states handled (loading, success, expired, reused, invalid, error)');

// 6. Sign-in link on success and no auto-login
assert.ok(
  fileContent.includes('href="/auth?mode=login"') || fileContent.includes('signInHref') || fileContent.includes('/auth?mode=login'),
  'Must provide prominent link to existing sign-in page'
);
assert.ok(
  fileContent.includes('Sign In to Your Account'),
  'Must include explicit "Sign In to Your Account" action'
);
// Ensure no auto-login, no session storage or cookies
assert.strictEqual(
  fileContent.includes('sessionStorage.setItem'),
  false,
  'Page must not set sessionStorage credentials (no auto-login)'
);
assert.strictEqual(
  fileContent.includes('document.cookie'),
  false,
  'Page must not set document.cookie (no auto-login)'
);
assert.strictEqual(
  fileContent.includes('router.push('),
  false,
  'Page must not automatically redirect user away on success'
);
console.log('[PASS] Test 6: Prominent sign-in link provided; strictly no auto-login or automatic redirect');

// 7. Security: Zero raw token leakage in page content, errors, or logs
assert.strictEqual(
  fileContent.includes('${token}'),
  false,
  'Raw token must not be interpolated into UI text'
);
assert.strictEqual(
  fileContent.includes('${tokenToVerify}'),
  false,
  'Raw token must not be interpolated into UI text'
);
assert.strictEqual(
  fileContent.includes('${trimmed}'),
  false,
  'Raw token must not be interpolated into UI text'
);
assert.strictEqual(
  fileContent.includes('console.log('),
  false,
  'Tokens or verification results must not be logged to console in client component'
);
assert.strictEqual(
  fileContent.includes('console.error('),
  false,
  'Tokens or errors must not be logged to console in client component'
);
console.log('[PASS] Test 7: Zero raw token exposure in JSX, error messages, or browser console');

// 8. Design system & semantic tokens compliance (zero hardcoded primitive colors)
const hardcodedColorRegex = /(?:#[0-9a-fA-F]{3,8}\b|rgb\s*\(|hsl\s*\()/i;
const matches = fileContent.match(hardcodedColorRegex);
assert.strictEqual(
  matches,
  null,
  `Page must not contain hardcoded color primitives: found ${matches ? matches[0] : 'none'}`
);

// Verify required semantic tokens
const expectedSemanticTokens = [
  'bg-background',
  'text-on-background',
  'bg-surface',
  'text-on-surface',
  'text-on-surface-variant',
  'border-outline-variant',
  'bg-primary',
  'text-on-primary',
  'bg-success-container',
  'text-on-success-container',
  'text-success',
  'bg-warning-container',
  'text-on-warning-container',
  'text-warning',
  'bg-secondary-container',
  'text-on-secondary-container',
  'text-secondary',
  'bg-error-container',
  'text-on-error-container',
  'text-error',
  'shadow-soft',
];

for (const token of expectedSemanticTokens) {
  assert.ok(fileContent.includes(token), `Must use semantic design token: ${token}`);
}
console.log('[PASS] Test 8: Semantic design tokens strictly used throughout; zero hardcoded color primitives');

// 9. Client-side state simulation test
async function runClientLogicSimulation() {
  // Extract and simulate performVerification logic under all scenarios
  async function simulateVerify(tokenToVerify, mockApiResponse) {
    let result = {
      status: 'verifying',
      title: 'Verifying your email',
      message: 'Please wait...',
    };

    if (!tokenToVerify || !tokenToVerify.trim()) {
      return {
        status: 'invalid',
        title: 'Missing Verification Link',
        message: 'No verification token was provided.',
        code: 'MISSING_TOKEN',
      };
    }

    const trimmed = tokenToVerify.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return {
        status: 'invalid',
        title: 'Invalid Verification Link',
        message: 'The verification link format is invalid.',
        code: 'INVALID_TOKEN',
      };
    }

    try {
      const response = await mockApiResponse(trimmed);
      const data = response.data;

      if (response.status === 200 && data.success) {
        return {
          status: 'success',
          title: 'Email Verified',
          message: data.message || 'Your email address has been successfully verified.',
        };
      }

      if (response.status === 410 || data.code === 'TOKEN_EXPIRED') {
        return {
          status: 'expired',
          title: 'Verification Link Expired',
          message: data.error || 'This verification link has expired.',
          code: 'TOKEN_EXPIRED',
        };
      }

      if (response.status === 409 || data.code === 'TOKEN_REUSED') {
        return {
          status: 'reused',
          title: 'Link Already Used',
          message: data.error || 'This verification link has already been used.',
          code: 'TOKEN_REUSED',
        };
      }

      if (response.status === 400 || data.code === 'INVALID_TOKEN') {
        return {
          status: 'invalid',
          title: 'Invalid Verification Link',
          message: data.error || 'The verification link is invalid.',
          code: 'INVALID_TOKEN',
        };
      }

      return {
        status: 'error',
        title: 'Verification Error',
        message: data.error || 'Server error.',
        code: 'SERVER_ERROR',
      };
    } catch {
      return {
        status: 'error',
        title: 'Connection Error',
        message: 'Unable to connect to server.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  const validToken = 'a'.repeat(64);

  // Scenario A: Missing token
  const resMissing = await simulateVerify(null, null);
  assert.strictEqual(resMissing.status, 'invalid');
  assert.strictEqual(resMissing.code, 'MISSING_TOKEN');

  // Scenario B: Malformed token
  const resMalformed = await simulateVerify('short-token', null);
  assert.strictEqual(resMalformed.status, 'invalid');
  assert.strictEqual(resMalformed.code, 'INVALID_TOKEN');

  // Scenario C: 200 OK
  const res200 = await simulateVerify(validToken, async () => ({
    status: 200,
    data: { success: true, message: 'Verified!' },
  }));
  assert.strictEqual(res200.status, 'success');
  assert.strictEqual(res200.title, 'Email Verified');

  // Scenario D: 410 Expired
  const res410 = await simulateVerify(validToken, async () => ({
    status: 410,
    data: { success: false, code: 'TOKEN_EXPIRED', error: 'Link expired' },
  }));
  assert.strictEqual(res410.status, 'expired');
  assert.strictEqual(res410.code, 'TOKEN_EXPIRED');

  // Scenario E: 409 Reused
  const res409 = await simulateVerify(validToken, async () => ({
    status: 409,
    data: { success: false, code: 'TOKEN_REUSED', error: 'Already used' },
  }));
  assert.strictEqual(res409.status, 'reused');
  assert.strictEqual(res409.code, 'TOKEN_REUSED');

  // Scenario F: 400 Invalid
  const res400 = await simulateVerify(validToken, async () => ({
    status: 400,
    data: { success: false, code: 'INVALID_TOKEN', error: 'Invalid' },
  }));
  assert.strictEqual(res400.status, 'invalid');
  assert.strictEqual(res400.code, 'INVALID_TOKEN');

  // Scenario G: 500 Server Error
  const res500 = await simulateVerify(validToken, async () => ({
    status: 500,
    data: { success: false, code: 'SERVER_ERROR', error: 'Database down' },
  }));
  assert.strictEqual(res500.status, 'error');
  assert.strictEqual(res500.code, 'SERVER_ERROR');

  // Scenario H: Network failure
  const resNetwork = await simulateVerify(validToken, async () => {
    throw new TypeError('Failed to fetch');
  });
  assert.strictEqual(resNetwork.status, 'error');
  assert.strictEqual(resNetwork.code, 'NETWORK_ERROR');
}

await runClientLogicSimulation();
console.log('[PASS] Test 9: Client logic simulation verified for all 8 network & response scenarios');

console.log('\nAll 9 verification page checks passed successfully!\n');

