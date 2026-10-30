const { spawn } = require('child_process');
const http = require('http');

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

async function main() {
  console.log('Starting Next.js production server for testing...');
  const server = spawn('cmd.exe', ['/c', 'npx', 'next', 'start', '-p', '3000'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  try {
    await waitForServer('http://localhost:3000/');
    console.log('Server is ready on http://localhost:3000. Running tests...');
    
    // Run test-task3-consolidated
    const { fork } = require('child_process');
    await new Promise((resolve, reject) => {
      const testProc = fork('scratch/test-task3-consolidated.js', [], { stdio: 'inherit' });
      testProc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Test exited with code ${code}`));
      });
    });

  } finally {
    console.log('Shutting down server...');
    // Kill the process tree on Windows
    spawn('taskkill', ['/pid', server.pid.toString(), '/f', '/t']);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

