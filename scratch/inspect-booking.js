const path = require('path');
const fs = require('fs');

// Load environment variables without third-party dependencies
function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectBookingAndWebhook() {
  const bookingRef = 'GP-V5SRFM';

  console.log(`\n======================================================================`);
  console.log(` Good Pets: Live Verification Report for Booking ${bookingRef}`);
  console.log(`======================================================================\n`);

  try {
    // 1. Fetch Booking
    const booking = await prisma.booking.findUnique({
      where: { reference: bookingRef },
      include: {
        payments: {
          orderBy: { initiatedAt: 'desc' },
        },
      },
    });

    if (!booking) {
      console.log(`❌ Booking Record: NOT FOUND for reference "${bookingRef}".`);
      return;
    }

    const paymentRefs = booking.payments.map((p) => p.reference);

    // 2. Fetch WebhookEvents
    const webhookEvents = await prisma.webhookEvent.findMany({
      where: {
        OR: [
          { reference: { contains: bookingRef } },
          ...(paymentRefs.length > 0 ? [{ reference: { in: paymentRefs } }] : []),
        ],
      },
      orderBy: { receivedAt: 'desc' },
    });

    const latestEvent = webhookEvents[0] || null;
    const latestPayment = booking.payments[0] || null;

    console.log(`--- QUESTION 1: Webhook Event Existence ---`);
    if (latestEvent) {
      console.log(`✅ Webhook Event Exists: YES (Found ${webhookEvents.length} event record(s))`);
      console.log(`   Event ID: ${latestEvent.id}`);
      console.log(`   DedupeKey: ${latestEvent.dedupeKey}`);
      console.log(`   Reference: ${latestEvent.reference}`);
    } else {
      console.log(`⚠️ Webhook Event Exists: NO webhook event matched "${bookingRef}" or its payment references.`);
      
      // Check if there are any recent webhook events in the table at all
      const anyRecent = await prisma.webhookEvent.findMany({
        take: 3,
        orderBy: { receivedAt: 'desc' },
      });
      if (anyRecent.length > 0) {
        console.log(`   (Note: Found other webhook events in database: ${anyRecent.map(e => e.reference).join(', ')})`);
      } else {
        console.log(`   (Note: The WebhookEvent table is currently empty. Webhook may not have reached this server URL.)`);
      }
    }

    console.log(`\n--- QUESTION 2: Event Type and Status ---`);
    if (latestEvent) {
      console.log(`   eventType: "${latestEvent.eventType}"`);
      console.log(`   status:    "${latestEvent.status}"`);
    } else {
      console.log(`   eventType: N/A`);
      console.log(`   status:    N/A`);
    }

    console.log(`\n--- QUESTION 3: ProcessedAt Value ---`);
    if (latestEvent) {
      console.log(`   processedAt: ${latestEvent.processedAt ? latestEvent.processedAt.toISOString() : 'NULL (not set)'}`);
    } else {
      console.log(`   processedAt: N/A`);
    }

    console.log(`\n--- QUESTION 4: Associated Payment Status ---`);
    if (latestPayment) {
      console.log(`   Payment Reference: ${latestPayment.reference}`);
      console.log(`   Payment Status:    "${latestPayment.status}" ${latestPayment.status === 'SUCCEEDED' ? '✅' : '⚠️'}`);
      console.log(`   Amount:            ${latestPayment.amountKobo} kobo (${latestPayment.currency})`);
      console.log(`   Channel:           ${latestPayment.channel || 'N/A'}`);
      console.log(`   Paid At:           ${latestPayment.paidAt ? latestPayment.paidAt.toISOString() : 'null'}`);
      console.log(`   Verified At:       ${latestPayment.verifiedAt ? latestPayment.verifiedAt.toISOString() : 'null'}`);
    } else {
      console.log(`   Payment Status:    NO PAYMENT RECORD FOUND for booking ${bookingRef}`);
    }

    console.log(`\n--- QUESTION 5: Booking Confirmation Status ---`);
    console.log(`   Booking Status:    "${booking.status}" ${booking.status === 'CONFIRMED' ? '✅' : '⚠️'}`);
    console.log(`   Confirmed At:      ${booking.confirmedAt ? booking.confirmedAt.toISOString() : 'NULL'}`);
    console.log(`   Hold Expires At:   ${booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : 'NULL (cleared on confirmation)'}`);

    console.log(`\n======================================================================\n`);

  } catch (err) {
    console.error('Database connection error during inspection:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

inspectBookingAndWebhook();
