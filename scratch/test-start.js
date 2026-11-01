const { spawn } = require("child_process");

const p = spawn("cmd.exe", ["/c", "npx", "next", "start", "-p", "3001"], { stdio: "pipe" });
p.stdout.on("data", d => process.stdout.write(d));
p.stderr.on("data", d => process.stderr.write(d));

setTimeout(async () => {
  try {
    const res = await fetch("http://127.0.0.1:3001/");
    console.log("Status:", res.status);
    const text = await res.text();
    if (text.includes("TypeError: e[o] is not a function") || text.includes("Server Error")) {
      console.log("ERROR FOUND IN PRODUCTION RESPONSE:");
      console.log(text.slice(0, 1000));
    } else {
      console.log("Production server SUCCESS! Status:", res.status);
      console.log("Preview:", text.slice(0, 300));
    }
  } catch (err) {
    console.error("Fetch err:", err);
  } finally {
    spawn("taskkill", ["/pid", p.pid.toString(), "/f", "/t"]);
  }
}, 3000);

