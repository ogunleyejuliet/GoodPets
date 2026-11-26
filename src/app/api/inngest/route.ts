import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { sendVerificationEmailFunction } from '@/inngest/functions/send-verification-email';
import { sendWelcomeEmailFunction } from '@/inngest/functions/send-welcome-email';
import { recoverStrandedOutboxFunction } from '@/inngest/functions/recover-stranded-outbox';

/**
 * Inngest API Route Handler
 *
 * Serves the Inngest execution pipeline via Next.js App Router.
 * Handles introspection, function registration, event dispatch, and execution steps.
 * Registers background email dispatch functions and scheduled cleanup jobs.
 * Automatically utilizes INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY from environment variables.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendVerificationEmailFunction,
    sendWelcomeEmailFunction,
    recoverStrandedOutboxFunction,
  ],
});
