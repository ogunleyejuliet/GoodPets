const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

// Parse .env.local without modifying it
const envPath = path.resolve(__dirname, '../.env.local');
let smtpHost = 'smtp.gmail.com';
let smtpPort = 465;
let smtpUser = 'ogunleyejuliet15@gmail.com';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (match[1] === 'SMTP_HOST') smtpHost = val;
      if (match[1] === 'SMTP_PORT') smtpPort = parseInt(val, 10);
      if (match[1] === 'SMTP_USER') smtpUser = val;
    }
  }
}

async function runControlledFailure() {
  console.log('=== GoodPets: Controlled SMTP Failure Test (Evidence 16) ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target Server: ${smtpHost}:${smtpPort}`);
  console.log(`Mailbox User: ${smtpUser}`);
  console.log('Credentials: [CONTROLLED_INVALID_PASSWORD_OVERRIDE]');
  console.log('------------------------------------------------------------');
  console.log('Attempting authentication against real SMTP server...\n');

  // Transporter configured with intentionally invalid credentials in memory only
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: 'invalid-controlled-test-password-12345',
    },
  });

  try {
    await transporter.verify();
    console.log('Unexpected success: SMTP server accepted invalid credentials.');
  } catch (err) {
    console.error('>> REAL SMTP SERVER REJECTION RECEIVED <<');
    console.error(`Status: FAILED (Expected controlled rejection)`);
    console.error(`Error Name: ${err.name}`);
    console.error(`Error Message: ${err.message}`);
    if (err.code) console.error(`Error Code: ${err.code}`);
    if (err.responseCode) console.error(`SMTP Response Code: ${err.responseCode}`);
    if (err.command) console.error(`Failing SMTP Command: ${err.command}`);
    if (err.response) {
      console.error('Server Raw Response:');
      console.error(err.response);
    }
    console.log('------------------------------------------------------------');
    console.log('Test completed: Real SMTP server rejected the connection as expected.');
  }
}

runControlledFailure();

