import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import type { Prisma, EmailOutbox } from '@prisma/client';

export class EncryptionKeyError extends Error {
  constructor(message: string = 'Encryption key is missing or invalid.') {
    super(message);
    this.name = 'EncryptionKeyError';
  }
}

/**
 * Resolves the 32-byte AES-256 encryption key.
 * Prioritizes EMAIL_TOKEN_ENCRYPTION_KEY. If omitted in non-production, falls back to a domain-separated
 * HMAC derivation from AUTH_SECRET so local/development environments remain functional.
 * In production (NODE_ENV === 'production'), EMAIL_TOKEN_ENCRYPTION_KEY is strictly required.
 */
export function getEmailTokenEncryptionKey(): Buffer {
  if (process.env.NODE_ENV === 'production' && !process.env.EMAIL_TOKEN_ENCRYPTION_KEY) {
    throw new EncryptionKeyError('EMAIL_TOKEN_ENCRYPTION_KEY is required in production.');
  }

  const envKey = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    if (Buffer.byteLength(envKey, 'utf8') === 32) {
      return Buffer.from(envKey, 'utf8');
    }
    // If key format is invalid, throw explicitly
    throw new EncryptionKeyError('EMAIL_TOKEN_ENCRYPTION_KEY must be a 32-byte string or 64-character hex string.');
  }

  const authSecret = process.env.AUTH_SECRET;
  if (authSecret && authSecret.length >= 32) {
    return crypto
      .createHmac('sha256', authSecret)
      .update('goodpets:email-token-encryption:v1')
      .digest();
  }

  throw new EncryptionKeyError('Neither EMAIL_TOKEN_ENCRYPTION_KEY nor AUTH_SECRET (>= 32 chars) is configured.');
}

/**
 * Encrypts a raw token string using AES-256-GCM.
 * Output format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function encryptTokenPayload(rawToken: string, keyBuffer?: Buffer): string {
  const key = keyBuffer || getEmailTokenEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(rawToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload and verifies message integrity.
 */
export function decryptTokenPayload(encryptedPayload: string, keyBuffer?: Buffer): string {
  const key = keyBuffer || getEmailTokenEncryptionKey();
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format.');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Creates an EmailOutbox record in the database.
 * Stores ONLY the AES-256-GCM encrypted payload; raw tokens are never persisted in plaintext.
 */
export async function createEmailOutboxRecord(
  params: {
    userId: string;
    tokenId?: string | null;
    toEmail: string;
    rawToken?: string;
    rawCode?: string;
  },
  tx: Prisma.TransactionClient = prisma
): Promise<EmailOutbox> {
  const tokenString = params.rawCode || params.rawToken || '';
  const encryptedPayload = encryptTokenPayload(tokenString);

  return await tx.emailOutbox.create({
    data: {
      userId: params.userId,
      tokenId: params.tokenId ?? null,
      toEmail: params.toEmail.trim().toLowerCase(),
      encryptedPayload,
      status: 'PENDING',
      attempts: 0,
      scheduledAt: new Date(),
    },
  });
}

/**
 * Creates an EmailOutbox record for a welcome email.
 * - tokenId is null because welcome emails do not involve an AuthToken.
 * - encryptedPayload stores metadata (e.g. customer name) encrypted via AES-256-GCM.
 */
export async function createWelcomeEmailOutboxRecord(
  params: {
    userId: string;
    toEmail: string;
    name?: string | null;
    customerId?: string | null;
  },
  tx: Prisma.TransactionClient = prisma
): Promise<EmailOutbox> {
  const payloadString = JSON.stringify({
    type: 'WELCOME',
    name: params.name || null,
    customerId: params.customerId || null,
  });
  const encryptedPayload = encryptTokenPayload(payloadString);

  return await tx.emailOutbox.create({
    data: {
      userId: params.userId,
      tokenId: null, // Explicitly null to distinguish from verification emails
      toEmail: params.toEmail.trim().toLowerCase(),
      encryptedPayload,
      status: 'PENDING',
      attempts: 0,
      scheduledAt: new Date(),
    },
  });
}

/**
 * Claims a pending or stale outbox record for processing using an atomic conditional update.
 * Prevents duplicate processing across multiple concurrent workers.
 */
export async function claimOutboxRecordForProcessing(
  outboxId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<EmailOutbox | null> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes stale threshold

  // Atomically claim if PENDING, abandoned PROCESSING, or retryable FAILED with attempts < 3 and scheduledAt <= now
  const result = await tx.emailOutbox.updateMany({
    where: {
      id: outboxId,
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', updatedAt: { lt: staleThreshold } },
        { status: 'FAILED', attempts: { lt: 3 }, scheduledAt: { lte: now } },
      ],
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
    },
  });

  if (result.count === 0) {
    return null; // Already claimed, not yet scheduled for retry, or in a terminal state
  }

  return await tx.emailOutbox.findUnique({ where: { id: outboxId } });
}

/**
 * Marks an outbox record as successfully sent.
 * Immediately purges the encrypted payload to minimize sensitive data retention.
 */
export async function markOutboxRecordSent(
  outboxId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  await tx.emailOutbox.update({
    where: { id: outboxId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      encryptedPayload: null, // Purge sensitive credential
      lastError: null,
    },
  });
}

/**
 * Marks an outbox record as failed and schedules a retry timestamp.
 */
export async function markOutboxRecordFailed(
  outboxId: string,
  errorMessage: string,
  nextScheduledAt?: Date,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  await tx.emailOutbox.update({
    where: { id: outboxId },
    data: {
      status: 'FAILED',
      lastError: errorMessage.slice(0, 500),
      scheduledAt: nextScheduledAt || new Date(Date.now() + 60 * 1000), // Default 1 minute retry
    },
  });
}

/**
 * Recovers abandoned processing records older than staleMinutes.
 * Resets status to PENDING so scheduled Inngest workers can re-attempt delivery,
 * or marks FAILED if max retries (3) have been exhausted.
 */
export async function recoverAbandonedOutboxRecords(
  staleMinutes: number = 5,
  db: typeof prisma = prisma
): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - staleMinutes * 60 * 1000);

  // 1. Recover abandoned records under 3 attempts back to PENDING for re-dispatch
  const result = await db.emailOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: cutoff },
      attempts: { lt: 3 },
    },
    data: {
      status: 'PENDING',
      scheduledAt: now,
    },
  });

  // 2. Mark records that exhausted all 3 attempts as FAILED to prevent indefinite processing
  await db.emailOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: cutoff },
      attempts: { gte: 3 },
    },
    data: {
      status: 'FAILED',
      lastError: 'Abandoned in PROCESSING and exceeded maximum delivery attempts (3).',
    },
  });

  return result.count;
}

/**
 * Finds pending outbox records that are stranded and eligible for re-dispatch:
 * 1. Newly created stranded records (attempts = 0, createdAt < cutoff)
 * 2. Recovered abandoned records reset from PROCESSING back to PENDING (attempts > 0, attempts < 3, scheduledAt <= now)
 */
export async function findStrandedPendingOutboxRecords(
  strandedMinutes: number = 2,
  limit: number = 50,
  db: typeof prisma = prisma
): Promise<Array<{ id: string; toEmail: string; userId: string; tokenId?: string | null; createdAt: Date; user?: { name: string | null } | null }>> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - strandedMinutes * 60 * 1000);

  return await db.emailOutbox.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: 3 },
      scheduledAt: { lte: now },
      OR: [
        // Case 1: Brand new stranded records (never claimed, older than cutoff)
        {
          attempts: 0,
          createdAt: { lt: cutoff },
        },
        // Case 2: Recovered abandoned records (reset from PROCESSING to PENDING)
        {
          attempts: { gt: 0 },
        },
      ],
    },
    select: {
      id: true,
      toEmail: true,
      userId: true,
      tokenId: true,
      createdAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}


