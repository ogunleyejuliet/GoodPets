const { spawn } = require("child_process");

console.log("Starting Next.js dev server on port 3000...");
const dev = spawn("cmd.exe", ["/c", "npx", "next", "dev", "-p", "3000"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.cwd()
});

let output = "";
dev.stdout.on("data", (data) => {
  const s = data.toString();
  output += s;
  process.stdout.write(s);
});

dev.stderr.on("data", (data) => {
  const s = data.toString();
  output += s;
  process.stderr.write(s);
});

// Run for 15 seconds to observe boot
setTimeout(() => {
  console.log("\nStopping dev server...");
  spawn("taskkill", ["/pid", dev.pid.toString(), "/f", "/t"]);
}, 12000);

