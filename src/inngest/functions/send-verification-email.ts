import { NonRetriableError, RetryAfterError } from 'inngest';
import { inngest } from '@/inngest/client';
import prisma from '@/lib/prisma';
import {
  claimOutboxRecordForProcessing,
  markOutboxRecordSent,
  markOutboxRecordFailed,
} from '@/lib/outbox';
import { sendVerificationEmailFromPayload, type SendEmailResult } from '@/lib/email';
import type { Transporter } from 'nodemailer';

export interface ProcessVerificationEmailOptions {
  name?: string;
  transporter?: Transporter;
}

export interface ProcessVerificationEmailResult {
  success: boolean;
  outboxId: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  reason?: string;
  messageId?: string;
  error?: string;
  retryable?: boolean;
  attempts?: number;
  delayMs?: number;
}

/**
 * Core outbox processing logic for verification emails.
 * Shared between the Inngest background worker and the immediate event-dispatch fallback.
 *
 * Enforces:
 * 1. Atomic row-level claim preventing duplicate concurrent processing.
 * 2. On success: marks SENT, sets sentAt, and purges AES-256-GCM encrypted payload.
 * 3. On failure: preserves retryable vs. permanent classification, updates outbox status and retry schedule.
 * 4. Never logs verification codes, passwords, or secrets.
 */
export async function processOutboxVerificationEmail(
  outboxId: string,
  options?: ProcessVerificationEmailOptions
): Promise<ProcessVerificationEmailResult> {
  // 1. Verify existence and handle duplicate / already-terminal states
  const existing = await prisma.emailOutbox.findUnique({
    where: { id: outboxId },
  });

  if (!existing) {
    return {
      success: false,
      outboxId,
      status: 'FAILED',
      error: 'Outbox record not found.',
      retryable: false,
    };
  }

  if (existing.status === 'SENT') {
    return {
      success: true,
      outboxId,
      status: 'SKIPPED',
      reason: 'ALREADY_SENT',
    };
  }

  // 2. Atomic claim using compare-and-swap (CAS)
  const claimedRecord = await claimOutboxRecordForProcessing(outboxId);

  if (!claimedRecord) {
    // Another worker claimed it or it transitioned to a terminal state concurrently
    const current = await prisma.emailOutbox.findUnique({
      where: { id: outboxId },
    });

    if (current?.status === 'SENT') {
      return {
        success: true,
        outboxId,
        status: 'SKIPPED',
        reason: 'ALREADY_SENT',
      };
    }

    if (current?.status === 'PROCESSING') {
      return {
        success: false,
        outboxId,
        status: 'FAILED',
        retryable: true,
        reason: 'ALREADY_PROCESSING',
        error: 'Outbox record is currently locked by another worker in PROCESSING.',
        delayMs: 60000,
      };
    }

    return {
      success: false,
      outboxId,
      status: 'SKIPPED',
      reason: 'COULD_NOT_CLAIM',
      retryable: true,
    };
  }

  // 3. Payload validation
  if (!claimedRecord.encryptedPayload) {
    const errorMsg = 'No encrypted payload found in outbox record.';
    await markOutboxRecordFailed(claimedRecord.id, errorMsg);
    return {
      success: false,
      outboxId,
      status: 'FAILED',
      error: errorMsg,
      retryable: false,
      attempts: claimedRecord.attempts,
    };
  }

  // 4. Decrypt payload and dispatch via SMTP
  let sendResult: SendEmailResult;
  try {
    sendResult = await sendVerificationEmailFromPayload({
      toEmail: claimedRecord.toEmail,
      encryptedPayload: claimedRecord.encryptedPayload,
      name: options?.name,
      transporter: options?.transporter,
    });
  } catch (err: any) {
    sendResult = {
      success: false,
      error: `Unexpected email dispatch error: ${err?.message || 'Unknown error'}`,
      retryable: true,
      permanent: false,
    };
  }

  // 5. Handle delivery outcome
  if (sendResult.success) {
    // Mark SENT and immediately purge sensitive encrypted payload
    await markOutboxRecordSent(claimedRecord.id);

    return {
      success: true,
      outboxId,
      status: 'SENT',
      messageId: sendResult.messageId,
      attempts: claimedRecord.attempts,
    };
  }

  // Failure handling
  const errorMsg = (sendResult.error || 'SMTP delivery failed').slice(0, 500);
  const isRetryable = Boolean(sendResult.retryable) && claimedRecord.attempts < 3;

  if (isRetryable) {
    // Exponential backoff: attempt 1 = 60s, attempt 2 = 120s
    const delaySeconds = Math.pow(2, claimedRecord.attempts) * 30;
    const delayMs = delaySeconds * 1000;
    const nextScheduledAt = new Date(Date.now() + delayMs);

    await markOutboxRecordFailed(claimedRecord.id, errorMsg, nextScheduledAt);

    return {
      success: false,
      outboxId,
      status: 'FAILED',
      error: errorMsg,
      retryable: true,
      attempts: claimedRecord.attempts,
      delayMs,
    };
  }

  // Permanent failure or retry limit (3 attempts) exhausted
  await markOutboxRecordFailed(claimedRecord.id, errorMsg);

  return {
    success: false,
    outboxId,
    status: 'FAILED',
    error: errorMsg,
    retryable: false,
    attempts: claimedRecord.attempts,
  };
}

/**
 * Inngest Background Function: Verification Email Delivery
 *
 * Event: auth/verification.email.requested
 * Max Retries: 3
 * Idempotency: Handled via database atomic CAS claim (claimOutboxRecordForProcessing)
 *              to prevent 24h event suppression during recovery redispatch.
 */
export const sendVerificationEmailFunction = inngest.createFunction(
  {
    id: 'send-verification-email',
    name: 'Send Verification Email',
    retries: 3,
    triggers: [{ event: 'auth/verification.email.requested' }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { outboxId, name } = (event.data || {}) as { outboxId?: string; name?: string };

    if (!outboxId || typeof outboxId !== 'string') {
      throw new NonRetriableError('Missing or invalid outboxId in event payload.');
    }

    const result = await step.run('deliver-verification-email', async () => {
      return await processOutboxVerificationEmail(outboxId, { name });
    });

    if (result.success) {
      return {
        status: result.status,
        outboxId,
        messageId: result.messageId,
        reason: result.reason,
      };
    }

    if (result.reason === 'ALREADY_PROCESSING') {
      // The record has an active lock held by another worker.
      // Do NOT complete as success. Throw RetryAfterError so Inngest retries after backoff.
      // If retries are exhausted, scheduled recovery cron will recover the record once it becomes stale (> 5 min).
      throw new RetryAfterError('Outbox record is currently locked by another worker in PROCESSING.', 60000);
    }

    if (!result.retryable) {
      throw new NonRetriableError(result.error || 'Permanent verification email delivery failure.');
    }

    const delayMs = result.delayMs || 30000;
    throw new RetryAfterError(result.error || 'Transient verification email delivery failure.', delayMs);
  }
);
