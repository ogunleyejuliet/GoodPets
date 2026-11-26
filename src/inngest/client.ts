import { Inngest } from 'inngest';

/**
 * GoodPets Inngest Client
 *
 * Configured per PRD Section 10 ("Time-based work runs in Inngest").
 * Reads INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY from environment variables.
 */
export const inngest = new Inngest({
  id: 'goodpets',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
