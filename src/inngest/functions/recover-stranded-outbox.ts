import { inngest } from '@/inngest/client';
import prisma from '@/lib/prisma';
import { findStrandedPendingOutboxRecords, recoverAbandonedOutboxRecords } from '@/lib/outbox';

export const RECOVERY_THRESHOLD_MINUTES = 5;
export const RECOVERY_BATCH_LIMIT = 25;

export interface StrandedOutboxRecoveryResult {
  recoveredCount: number;
  abandonedResetCount?: number;
  outboxIds: string[];
  message?: string;
}

/**
 * Core business logic for recovering stranded outbox records.
 * 1. Recovers abandoned PROCESSING records older than thresholdMinutes back to PENDING.
 * 2. Queries eligible PENDING records (newly stranded attempts=0 and recovered attempts>0),
 *    and re-dispatches Inngest events in bounded batches.
 */
export async function runStrandedOutboxRecovery(params?: {
  thresholdMinutes?: number;
  batchLimit?: number;
  db?: typeof prisma;
  inngestClient?: typeof inngest;
}): Promise<StrandedOutboxRecoveryResult> {
  const threshold = params?.thresholdMinutes ?? RECOVERY_THRESHOLD_MINUTES;
  const limit = params?.batchLimit ?? RECOVERY_BATCH_LIMIT;
  const db = params?.db ?? prisma;
  const client = params?.inngestClient ?? inngest;

  // 1. Recover abandoned PROCESSING records older than threshold back to PENDING
  const abandonedResetCount = await recoverAbandonedOutboxRecords(threshold, db);

  // 2. Query eligible PENDING records (both newly stranded attempts=0 and recovered attempts>0)
  const strandedRecords = await findStrandedPendingOutboxRecords(threshold, limit, db);

  if (!strandedRecords || strandedRecords.length === 0) {
    return {
      recoveredCount: 0,
      abandonedResetCount,
      outboxIds: [],
      message: abandonedResetCount > 0
        ? `Reset ${abandonedResetCount} abandoned PROCESSING records to PENDING.`
        : 'No stranded outbox records found.',
    };
  }

  const events = strandedRecords.map((record) => {
    // Distinguish verification emails (linked to an AuthToken) from welcome emails (tokenId is null)
    const isWelcome = !record.tokenId;
    return {
      name: isWelcome ? 'auth/welcome.email.requested' : 'auth/verification.email.requested',
      data: {
        outboxId: record.id,
        email: record.toEmail,
        name: record.user?.name || undefined,
      },
    };
  });

  // Re-dispatch batch to Inngest
  await client.send(events);

  return {
    recoveredCount: events.length,
    abandonedResetCount,
    outboxIds: strandedRecords.map((r) => r.id),
  };
}

/**
 * Scheduled Inngest Cron Function: Recover Stranded Outbox Records
 *
 * Runs every 5 minutes to identify and re-dispatch
 * unhandled PENDING outbox records older than RECOVERY_THRESHOLD_MINUTES.
 */
export const recoverStrandedOutboxFunction = inngest.createFunction(
  {
    id: 'recover-stranded-outbox',
    name: 'Recover Stranded Outbox Records',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const result = await step.run('recover-stranded-outbox-records', async () => {
      return await runStrandedOutboxRecovery();
    });

    return result;
  }
);
