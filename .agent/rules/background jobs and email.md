---
trigger: glob
globs:   "**/inngest/**"  "**/api/inngest/**"  "**/*{email,reminder,cleanup,nightly}*.{ts,tsx}"  "**/emails/**"
---

description: Inngest jobs, schedules, reminders, cleanup and email delivery rules for Good Pets.
---

# Background jobs and email

Job: everything that runs on a timer or sends an email.

## Jobs

1. Run all time-based work in Inngest, served at `/api/inngest`. Never use `setTimeout`, sleeping requests or Vercel cron. Reason: the free Vercel plan cannot run these schedules.
2. Keep each step short and safe to repeat. Reason: Inngest retries steps.
3. Use these functions, all on Lagos time:
   - Hold expiry runs at each booking's `holdExpiresAt`. The logic is in `booking-and-capacity.md`.
   - Payment reconciliation runs every 10 minutes. The logic is in `payments-paystack.md`.
   - Service reminders run daily at 17:00.
   - Daycare pickup reminders run at 17:00 and 19:00.
   - The nightly status job runs daily at 00:30.
   - Retention cleanup runs daily.
   Reason: this is the full list in the PRD. Confirm the cron time zone is supported before relying on it (OQ-23).
4. The service reminder goes to each CONFIRMED booking whose first service date is tomorrow. A booking made after 17:00 for the next day gets no reminder because the confirmation email served that purpose (FR-037). Reason: it avoids a duplicate email.
5. Pickup reminders go to daycare bookings checked in today and not yet collected, exactly two per booking. Reason: no pickup reminder should ever go out for a pet already collected.
6. Reminders read the current booking on each run. A rescheduled booking never gets a reminder for its old date. Reason: stale reminders confuse customers.
7. The nightly job sets a booking COMPLETED when every service day has a CHECK_OUT, or when the last day has a CHECK_IN and a check-out exists. It sets NO_SHOW when no CHECK_IN ever exists. It leaves other cases for the manager (FR-044). Reason: it must not guess.
8. Cleanup deletes expired conversations, rate-limit rows older than 1 day, webhook events older than 90 days, used or expired auth tokens older than 7 days and accounts unverified after 7 days (FR-043). It never touches bookings, payments, handover records or audit events. Reason: retention stops at personal and temporary data only.