/**
 * GoodPets Task 4 Step 10: Stage 7.1 — Inngest Foundation Verification Test Suite
 *
 * Requirements Verified:
 * 1. inngest package is installed in package.json and importable.
 * 2. Inngest client is initialized in src/inngest/client.ts with ID "goodpets".
 * 3. Next.js App Router API route at src/app/api/inngest/route.ts exports GET, POST, PUT.
 * 4. Route handler responds to introspection GET requests with HTTP 200 in Dev mode.
 * 5. Route handler enforces cryptographic signature verification (HTTP 401 without signature) in Cloud mode.
 * 6. Inngest client handles environment configuration (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY).
 * 7. Existing verification, tokens, and outbox functions remain intact (strict boundaries).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Inngest } = require('inngest');

console.log('=== Stage 7.1: Inngest Foundation Verification Suite ===\n');

const ROOT = path.resolve(__dirname, '..');

// TypeScript loader for testing App Router files without external runners
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
      const candidates = [
        path.resolve(ROOT, mappedRel + '.ts'),
        path.resolve(ROOT, mappedRel + '.tsx'),
        path.resolve(ROOT, mappedRel, 'index.ts'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          return loadTsModule(path.relative(ROOT, c), customMocks);
        }
      }
    }
    return originalRequire(request);
  };

  mod._compile(transpiled.outputText, fullPath);
  return mod.exports;
}

async function runSuite() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  // 1. Dependency check
  test('1. inngest dependency installed in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert(pkg.dependencies && pkg.dependencies.inngest, 'inngest must be listed under dependencies');
    console.log(`     -> inngest version: ${pkg.dependencies.inngest}`);
  });

  // 2. Client export and configuration
  test('2. src/inngest/client.ts exports Inngest client with ID "goodpets"', () => {
    const clientModule = loadTsModule('src/inngest/client.ts');
    assert(clientModule.inngest, 'inngest client must be exported');
    assert(clientModule.inngest instanceof Inngest, 'Export must be instance of Inngest');
    assert.strictEqual(clientModule.inngest.id, 'goodpets', 'Inngest client id must be "goodpets"');
  });

  // 3. App Router API Route exports
  test('3. src/app/api/inngest/route.ts exports GET, POST, and PUT handlers', () => {
    const routeModule = loadTsModule('src/app/api/inngest/route.ts');
    assert.strictEqual(typeof routeModule.GET, 'function', 'route.ts must export GET handler');
    assert.strictEqual(typeof routeModule.POST, 'function', 'route.ts must export POST handler');
    assert.strictEqual(typeof routeModule.PUT, 'function', 'route.ts must export PUT handler');
  });

  // 4a. Introspection in Dev mode
  await testAsync('4a. GET /api/inngest responds with HTTP 200 in Dev mode (INNGEST_DEV=1)', async () => {
    const prevDev = process.env.INNGEST_DEV;
    process.env.INNGEST_DEV = '1';
    try {
      const routeModule = loadTsModule('src/app/api/inngest/route.ts');
      const req = new Request('http://localhost:3000/api/inngest', {
        method: 'GET',
        headers: { host: 'localhost:3000' },
      });

      const res = await routeModule.GET(req);
      assert.strictEqual(res.status, 200, 'GET introspection should return status 200 in dev mode');
      const body = await res.json();
      assert.strictEqual(body.mode, 'dev', 'Introspection mode must be "dev"');
      assert(body.function_count >= 0, 'Introspection function count must be non-negative');
      assert(body.schema_version !== undefined, 'Schema version must be present');
      console.log(`     -> Dev mode verified: mode=${body.mode}, schema_version=${body.schema_version}, functions=${body.function_count}`);
    } finally {
      if (prevDev !== undefined) process.env.INNGEST_DEV = prevDev;
      else delete process.env.INNGEST_DEV;
    }
  });

  // 4b. Security check in Cloud mode: missing signature rejected with HTTP 401
  await testAsync('4b. GET /api/inngest rejects unsigned request with HTTP 401 in Cloud mode', async () => {
    const prevKey = process.env.INNGEST_SIGNING_KEY;
    const prevDev = process.env.INNGEST_DEV;
    delete process.env.INNGEST_DEV;
    process.env.INNGEST_SIGNING_KEY = 'signkey-test-0123456789abcdef0123456789abcdef';
    try {
      const routeModule = loadTsModule('src/app/api/inngest/route.ts');
      const req = new Request('http://localhost:3000/api/inngest', {
        method: 'GET',
        headers: { host: 'localhost:3000' },
      });

      const res = await routeModule.GET(req);
      assert.strictEqual(res.status, 401, 'Unsigned request must receive HTTP 401 Unauthorized');
      console.log(`     -> Signature security verified: Unsigned request rejected with HTTP ${res.status}`);
    } finally {
      if (prevKey !== undefined) process.env.INNGEST_SIGNING_KEY = prevKey;
      else delete process.env.INNGEST_SIGNING_KEY;
      if (prevDev !== undefined) process.env.INNGEST_DEV = prevDev;
    }
  });

  // 5. Environment variable conventions
  test('5. Environment variable definitions match PRD conventions', () => {
    const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    assert(envExample.includes('INNGEST_EVENT_KEY='), '.env.example must define INNGEST_EVENT_KEY');
    assert(envExample.includes('INNGEST_SIGNING_KEY='), '.env.example must define INNGEST_SIGNING_KEY');
  });

  // 6. Strict boundaries: existing services untouched
  test('6. Strict boundaries: Tokens, Outbox, and Email services intact', () => {
    const outboxModule = loadTsModule('src/lib/outbox.ts');
    assert(typeof outboxModule.createEmailOutboxRecord === 'function', 'Outbox creation preserved');
    assert(typeof outboxModule.claimOutboxRecordForProcessing === 'function', 'Outbox claim preserved');
    assert(typeof outboxModule.markOutboxRecordSent === 'function', 'Outbox mark sent preserved');

    const tokensModule = loadTsModule('src/lib/tokens.ts');
    assert(typeof tokensModule.generateRawVerificationCode === 'function', 'Verification code generation preserved');
    assert(typeof tokensModule.hashVerificationCode === 'function', 'Verification code HMAC hashing preserved');
    assert(typeof tokensModule.consumeVerificationCode === 'function', 'Verification code consume preserved');

    const emailModule = loadTsModule('src/lib/email.ts');
    assert(typeof emailModule.sendVerificationEmailDirect === 'function', 'Direct email dispatch preserved');
  });

  console.log(`\nResults: ${passed}/${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
