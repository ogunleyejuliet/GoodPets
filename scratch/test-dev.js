const { spawn } = require("child_process");

const p = spawn("cmd.exe", ["/c", "npx", "next", "dev", "-p", "3000"], { stdio: "pipe" });
p.stdout.on("data", d => process.stdout.write(d));
p.stderr.on("data", d => process.stderr.write(d));

setTimeout(async () => {
  try {
    const res = await fetch("http://127.0.0.1:3000/");
    console.log("Status:", res.status);
    const text = await res.text();
    if (text.includes("TypeError: e[o] is not a function") || text.includes("error")) {
      console.log("ERROR FOUND IN RESPONSE:");
      console.log(text.slice(0, 1000));
    } else {
      console.log("Preview:", text.slice(0, 300));
    }
  } catch (err) {
    console.error("Fetch err:", err);
  } finally {
    spawn("taskkill", ["/pid", p.pid.toString(), "/f", "/t"]);
  }
}, 5000);

