---
trigger: glob
globs: "**/*{pickup,checkout,check-out,check-in,handover,authorization,collector}*.{ts,tsx}" "**/staff/**"
---

description: Who may collect a pet, how check-in and check-out are recorded, and late pickup.
---

# Pickup and check-out

Job: make sure a pet only leaves with the right person and that every handover is recorded.

1. The owner collects by default. The owner can authorize other people per booking, each registered on their own with name and phone. Allow at most 3 active authorizations per booking. An authorization ends at the end of the booking's last service day in Lagos (BR-025). Reason: a short, small list limits risk.
2. An authorization is ACTIVE or REVOKED. A revoked one never comes back. Make a new one instead. Reason: history must stay honest.
3. Authorized people have no account and never use the app. Reason: the owner is the only account holder.
4. Check-out needs a selected collector, who is the owner or an active authorized person, and the ID type the staff member saw. The server rejects anything else. A booking reference alone never allows check-out (BR-026). Reason: a reference can be overheard or guessed, and the pet could be taken.
5. Store the ID type only. Never store, log or send an ID number. Reason: we do not want that data.
6. Staff-assisted authorization needs a typed reason of at least 10 characters, writes an audit event and emails the owner (BR-027). Reason: a caller claiming to be the owner is the classic attack.
7. Record handovers by service. Grooming has one CHECK_IN and one CHECK_OUT on the service date. Daycare has one of each per service day. Boarding has a CHECK_IN on the check-in date and a CHECK_OUT on the check-out date. A CHECK_OUT needs a CHECK_IN on or before its date, and a missing CHECK_IN can be recorded late at the desk (BR-028). Reason: the record proves who had the pet and when.
8. Staff judge a daycare pickup as late if it is after the closing time in service settings (default 8:00 PM). They tick it at check-out. The penalty is ₦5,000 (500,000 kobo) per pet, stored on the check-out record and paid in cash at the desk (BR-029). Reason: the PRD keeps late fees out of the payment system.
9. Never send the late penalty to Paystack, store it as a balance, or build a way to charge it in the app. Reason: it is out of scope for Version One.
10. A no-show has no penalty and no refund (BR-030). Reason: there is no money flow to build.