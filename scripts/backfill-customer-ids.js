/**
 * GoodPets - Customer ID Backfill Script
 * 
 * Purpose:
 * Safely backfills unique 4-digit numeric Customer IDs (1000-9999) to existing customers
 * who currently have customerId = NULL.
 * 
 * Safety invariants:
 * - Does not overwrite existing customer IDs.
 * - Enforces uniqueness across the entire 1000-9999 pool.
 * - Detects pool exhaustion (9,000 capacity limit) and aborts safely.
 * - Preserves all existing user fields and credentials.
 * - Completely safe to rerun (idempotent: does nothing if all customers already have an ID).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local and .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
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

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
});

async function backfillCustomerIds() {
  console.log('=== GoodPets: Customer ID Backfill Process ===');
  const startTime = Date.now();

  try {
    // 1. Fetch all existing assigned customer IDs across the entire User table
    const existingAssigned = await prisma.user.findMany({
      where: { customerId: { not: null } },
      select: { id: true, customerId: true, email: true },
    });

    const usedIds = new Set(existingAssigned.map((u) => u.customerId));
    console.log(`[Info] Currently assigned Customer IDs: ${usedIds.size}`);

    // 2. Fetch all customers lacking a Customer ID
    const unassignedCustomers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        customerId: null,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (unassignedCustomers.length === 0) {
      console.log('✔ All customers already have a unique Customer ID. No backfill needed.');
      return;
    }

    console.log(`[Info] Found ${unassignedCustomers.length} customer(s) without Customer ID.`);

    // 3. Build available pool from 1000 to 9999
    const availablePool = [];
    for (let i = 1000; i <= 9999; i++) {
      const candidate = i.toString();
      if (!usedIds.has(candidate)) {
        availablePool.push(candidate);
      }
    }

    console.log(`[Info] Available 4-digit ID slots remaining: ${availablePool.length} of 9,000`);

    // 4. Check for capacity exhaustion
    if (unassignedCustomers.length > availablePool.length) {
      throw new Error(
        `CAPACITY EXHAUSTED: Cannot assign Customer IDs to ${unassignedCustomers.length} customers. Only ${availablePool.length} slots remain in the 1000-9999 range. Halting backfill to avoid format mutation.`
      );
    }

    // 5. Shuffle available pool cryptographically to distribute IDs uniformly
    for (let i = availablePool.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [availablePool[i], availablePool[j]] = [availablePool[j], availablePool[i]];
    }

    // 6. Assign unique IDs to each customer sequentially in transaction
    let backfilledCount = 0;

    for (let i = 0; i < unassignedCustomers.length; i++) {
      const customer = unassignedCustomers[i];
      const assignedId = availablePool[i];

      await prisma.user.update({
        where: { id: customer.id },
        data: { customerId: assignedId },
      });

      usedIds.add(assignedId);
      backfilledCount++;

      // Log assignment without exposing PII (masking email)
      const maskedEmail = customer.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}***${c}`);
      console.log(`  [Assigned] User ${customer.id} (${maskedEmail}) -> Customer ID: ${assignedId}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✔ Backfill completed successfully in ${elapsed}ms.`);
    console.log(`  Total backfilled: ${backfilledCount}`);
    console.log(`  Remaining capacity in pool: ${availablePool.length - backfilledCount}`);
  } catch (error) {
    console.error('✖ Backfill failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  backfillCustomerIds();
}

module.exports = { backfillCustomerIds };

