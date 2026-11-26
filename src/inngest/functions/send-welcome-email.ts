import { NonRetriableError, RetryAfterError } from 'inngest';
import { inngest } from '@/inngest/client';
import prisma from '@/lib/prisma';
import {
  claimOutboxRecordForProcessing,
  markOutboxRecordSent,
  markOutboxRecordFailed,
} from '@/lib/outbox';
import { sendWelcomeEmailFromPayload, type SendEmailResult } from '@/lib/email';
import type { Transporter } from 'nodemailer';

export interface ProcessWelcomeEmailOptions {
  name?: string;
  customerId?: string;
  transporter?: Transporter;
}

export interface ProcessWelcomeEmailResult {
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
 * Core outbox processing logic for welcome emails.
 *
 * Enforces:
 * 1. Atomic row-level claim preventing duplicate concurrent processing.
 * 2. On success: marks SENT, sets sentAt, and purges AES-256-GCM encrypted payload.
 * 3. On failure: preserves retryable vs. permanent classification, updates outbox status and retry schedule.
 * 4. Never logs passwords or secrets.
 */
export async function processOutboxWelcomeEmail(
  outboxId: string,
  options?: ProcessWelcomeEmailOptions
): Promise<ProcessWelcomeEmailResult> {
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

  // 3. Dispatch welcome email via SMTP
  let sendResult: SendEmailResult;
  try {
    sendResult = await sendWelcomeEmailFromPayload({
      toEmail: claimedRecord.toEmail,
      encryptedPayload: claimedRecord.encryptedPayload,
      name: options?.name,
      customerId: options?.customerId,
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

  // 4. Handle delivery outcome
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
 * Inngest Background Function: Welcome Email Delivery
 *
 * Event: auth/welcome.email.requested
 * Max Retries: 3
 * Idempotency: Handled via database atomic CAS claim (claimOutboxRecordForProcessing)
 */
export const sendWelcomeEmailFunction = inngest.createFunction(
  {
    id: 'send-welcome-email',
    name: 'Send Welcome Email',
    retries: 3,
    triggers: [{ event: 'auth/welcome.email.requested' }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { outboxId, name, customerId } = (event.data || {}) as {
      outboxId?: string;
      name?: string;
      customerId?: string;
    };

    if (!outboxId || typeof outboxId !== 'string') {
      throw new NonRetriableError('Missing or invalid outboxId in event payload.');
    }

    const result = await step.run('deliver-welcome-email', async () => {
      return await processOutboxWelcomeEmail(outboxId, { name, customerId });
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
      throw new RetryAfterError('Outbox record is currently locked by another worker in PROCESSING.', 60000);
    }

    if (!result.retryable) {
      throw new NonRetriableError(result.error || 'Permanent welcome email delivery failure.');
    }

    const delayMs = result.delayMs || 30000;
    throw new RetryAfterError(result.error || 'Transient welcome email delivery failure.', delayMs);
  }
);
