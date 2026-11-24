const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

// Parse .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
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
      process.env[match[1]] = val;
    }
  }
}

async function testSmtp() {
  console.log('Testing SMTP connection with:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✓ SMTP Connection verified successfully!');

    console.log('\nSending real test verification email to:', process.env.SMTP_USER);
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Good Pets <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Good Pets — SMTP Live Test Verification Code: 481920',
      text: 'Good Pets verification code: 481920. Valid for 10 minutes.',
      html: '<h2>Good Pets</h2><p>Your verification code is: <strong>481920</strong> (expires in 10 minutes).</p>',
    });
    console.log('✓ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (err) {
    console.error('✗ SMTP error:', err.message);
    if (err.code) console.error('Error Code:', err.code);
    if (err.responseCode) console.error('Response Code:', err.responseCode);
  }
}

testSmtp();
