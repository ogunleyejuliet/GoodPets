---
trigger: glob
globs: "**/*{booking,capacity,availability,reschedule,hold}*.{ts,tsx}" "**/api/availability/**" "**/api/bookings/**"
---

description: Capacity holds, status changes, reschedule and move rules for Good Pets bookings.
---

# Booking and capacity

Job: how places are held, released, confirmed and moved. This is the core correctness rule of the app.

## Reserving

1. Create the booking as PENDING_PAYMENT and hold every unit before any payment call. Reason: a customer must never pay for a place that is already gone.
2. Reserve all units in one all-or-nothing transaction. If one unit fails, roll back and say the place was just taken. Reason: a partial hold strands capacity.
3. Take units in a fixed order: service, date, slot. Reason: a fixed order prevents deadlocks.
4. Reserve each unit with one conditional update that adds 1 only where reserved plus 1 is at most capacity. Zero rows changed means full. Never read then write. Reason: the row lock lets only one parallel request win the last place.
5. Create a missing capacity row with insert on conflict do nothing, using the default from service settings. Reason: no pre-seeding of dates and no duplicate rows.
6. Read capacity, hold length, hours and cut-off days from service settings, never from constants. Reason: the manager changes them. Defaults: grooming has 3 slots a day with 2 places each, daycare has 20 a day, boarding has 16 a night. Dogs and cats share pools. Boarding does not use daycare capacity (BR-008, BR-009).
7. A boarding night counts against the date it starts. The check-out day uses no kennel (BR-010). Reason: a stay from 20 to 27 December is 7 nights.
8. Reject a booking when the same pet has an overlapping booking, when the customer already has 2 pending bookings, when the IP already has 3, or when the first date is not at least the next Lagos day (BR-041 to BR-043). Reason: these stop duplicate submissions and one source holding many places.
9. Create bookings with the idempotency key from checkout. The same key and inputs return the same booking. Reason: double clicks and dropped connections must not create two bookings.
10. Generate the reference on the server as `GP-` plus 6 characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, unique (BR-038). Reason: it is easy to read aloud and has no look-alike characters.

## Holds and release

11. Card holds last 10 minutes. Bank transfer holds are a 30-minute placeholder (BR-017). Held places count as taken in availability. Reason: BR-012.
12. Release each allocation at most once. Set `releasedAt` in the same transaction and decrement only rows with no `releasedAt`. Reason: a double release lets the app overbook.
13. Before checking capacity, release expired holds on the units you need. Availability reads never write. Reason: a slow expiry job must not block a real customer.
14. The hold expiry function re-reads the booking. If it is still PENDING_PAYMENT, verify any open payment first. If paid, confirm. If not, set EXPIRED and release once (FR-017). Reason: a paying customer must never be expired.

## Status

15. Allow only the status changes in PRD section 8.3 and reject any other on the server. Reason: a loose state machine hides money bugs.
16. Confirm through one shared function in one transaction that locks the booking row with `SELECT ... FOR UPDATE`. The webhook, the return page check, reconciliation and the expiry job all call it. Whichever runs second finds the booking decided and does nothing. Reason: four callers can otherwise confirm twice or confirm after expiry.
17. A verified payment on an EXPIRED booking triggers one attempt to take the same units. Success confirms. Failure sets NEEDS_ATTENTION and the booking shows "We received your payment but could not secure your dates. The front desk will contact you." (BR-018, FR-019). Reason: the customer paid, so the manager must resolve it and the app must not oversell.

## Closures, reschedule and move

18. A closure blocks new allocation only. Existing bookings stay as they are (BR-024). Reason: customers keep the places they paid for.
19. A customer can reschedule only a CONFIRMED booking, with the same pet, service, package and quantity, to a later first date, with all new units available and no price change. They can do it more than once inside the window (BR-021, BR-022). Reason: no money moves.
20. The cut-off is the number of Lagos calendar days between today and the first service date: at least 2 for grooming, 1 for daycare, 4 for boarding (BR-020). Reason: the business needs notice to plan staff and kennels.
21. Reserve the new units and release the old ones in one transaction. Reason: the customer must not lose the old dates if the new ones fail.
22. A manager move keeps the same quantity, ignores the cut-off, needs a reason, charges nothing and writes an audit event (BR-023). Reason: it is the fix for NEEDS_ATTENTION, and it must leave a trail.