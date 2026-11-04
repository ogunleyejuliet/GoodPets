const { spawn, fork } = require('child_process');
const http = require('http');

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.setTimeout(1500, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

async function main() {
  const PORT = 3001;
  const URL = `http://127.0.0.1:${PORT}`;
  console.log(`Starting Next.js production server on ${URL} for Stage 5 verification...`);
  const server = spawn('cmd.exe', ['/c', 'npx', 'next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PAYSTACK_MOCK_MODE: 'true',
    },
  });

  let exitCode = 0;
  try {
    await waitForServer(`${URL}/api/auth/me`);
    console.log(`Server is online at ${URL}. Running Stage 5 tests...\n`);

    await new Promise((resolve, reject) => {
      const testProc = fork('scratch/test-stage5.js', [], {
        stdio: 'inherit',
        env: {
          ...process.env,
          BASE_URL: URL,
          PAYSTACK_MOCK_MODE: 'true',
        },
      });

      testProc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          exitCode = code || 1;
          reject(new Error(`Test process failed with code ${code}`));
        }
      });
    });
  } catch (err) {
    console.error('Test run failed:', err.message);
    exitCode = 1;
  } finally {
    console.log('\nShutting down server...');
    try {
      spawn('taskkill', ['/pid', server.pid.toString(), '/f', '/t']);
    } catch {
      // ignore
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
