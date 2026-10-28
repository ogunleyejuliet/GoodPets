# Good Pets

## Description
Good Pets is a web app for a fictional pet-care business at one location in Victoria Island, Lagos, built as a portfolio project.
Pet owners book and pay for dog and cat grooming, daycare and boarding and ask an AI assistant questions, while front desk and manager staff run arrivals, pickups and settings.
A booking is confirmed only after the server verifies the payment, and Paystack runs in test mode so no real money moves.

## Who uses it
- Pet owner (customer): owns dogs or cats, has an account with an email verified once, and signs in with email and password. Sees only their own data.
- Authorized pickup person: registered by an owner to collect a pet for one booking. Has no account and does not use the app.
- Front desk staff: runs the counter, check-in, check-out, collector verification and support requests. Cannot change prices, capacity or published content.
- Manager: does everything front desk does, plus settings, assistant content, moving bookings and the audit log. Manager-only actions return 403 to front desk.
- Visitor (not signed in): can view pages, prices, availability and the assistant. Cannot book.
- The PRD marks the front desk and manager split and the visitor assistant access as defaults until the owner decides (OQ-27 and OQ-34).

## One thing the agent must do well
Keep the booking and payment flow correct. Pressing Pay holds capacity before payment, reserved places never exceed capacity, and the booking is confirmed only after verified payment. The exact checks are under "How to work in this codebase".
The primary success metric is the pass rate of the critical flows in automated tests against Paystack test mode (PRD section 13). The critical flows are: book and pay by card, the bank transfer path with simulated webhooks, reschedule, authorize pickup, check-out, and one assistant question.

## Defined scope for the MVP
The PRD calls the MVP Version One. It is complete when the acceptance criteria in PRD section 17 pass. Version One contains:
1. Landing page and service pages with prices.
2. Sign-up with one-time email verification, sign-in with email and password, password reset, profile and pets.
3. Live availability.
4. Booking for grooming, daycare and boarding with price calculation and a capacity hold.
5. Paystack payment in test mode with card and bank transfer, return page, webhook, hold expiry and reconciliation.
6. Confirmation, reschedule and reminder emails.
7. My bookings, reschedule and pickup authorization.
8. Staff area: arrivals, check-in, check-out with collector verification, staff-assisted authorization, late-pickup record and support inbox.
9. Manager area: needs attention list, move booking, settings, knowledge base and audit log.
10. RAG assistant with availability and price tools.
11. Background jobs (hold expiry, reconciliation, email sending with retry, reminders, the nightly job and cleanup), rate limiting, Sentry error monitoring and seed data.
12. Mobile and tablet responsive layout.

Build P0 first, then P1, then P2. PRD section 6 lists the requirements in each tier. Dropping P2 must not break P0 or P1.
Build only what traces to a requirement in PRD section 7. If it is not there, stop and ask.

## Not in scope for the MVP
The PRD says these must not be built in Version One:
- Refunds, cancellations, credits, or any money returned to customers.
- Late-pickup payment through Paystack or in the app.
- Vaccination document upload or verification, missing-evidence rules, temperament checks and weight-mismatch rules.
- Analytics tools, dashboards and custom event tracking.
- Generic tax or fees on prices.
- Emailed sign-in links. Emailed verification and password reset links are in scope.
- Social or third-party sign-in, phone sign-in and customer-facing email change.
- Account lock screens. Sign-in throttling is in scope.
- Screens for viewing or revoking sessions. A password reset still invalidates all older sessions.
- Knowledge base version history.
- The assistant creating, changing, rescheduling or cancelling bookings.
- Live Paystack mode, real settlements and payment disputes.
- SMS or WhatsApp notifications, in-app notification history and pet photos.
- Multiple locations and multiple businesses.
- Bookings for several pets in one basket.
- Staff creating bookings on behalf of customers.
- Self-service data export and account deletion. The PRD says deletion on request anonymises personal fields and keeps booking and payment records.
- Groomer selection by the customer.
- Offline mode for customers or staff.
- Authenticator-app codes for staff, unless the owner decides (OQ-22).
- Infrastructure beyond the stack in this file. FR-008 allows a short cache on the availability endpoint.

Future considerations in the PRD, also not part of Version One: one-tap book again, multi-pet bookings, staff-created walk-in bookings, automated late-pickup billing, earlier-date rescheduling, SMS or WhatsApp reminders, customer data export and deletion, reviews and photos.

## Stack
Fixed by the product owner:
- Next.js with TypeScript
- Prisma
- PostgreSQL
- Paystack for payments, test mode only
- pgvector for vector data
- OpenAI API for chat and embeddings, through the official SDK

Also confirmed in PRD section 10:
- React, App Router, Tailwind CSS and shadcn/ui for the frontend.
- Auth.js with the Credentials provider and JWT sessions.
- Resend for email, Inngest for background jobs, Sentry for error capture.
- Vercel for deployment and GitHub for the repository.
- Vitest and Playwright for tests.

Stack facts from the PRD:
- No technology is replaced and no other infrastructure is added.
- The OpenAI chat model is not chosen (OQ-19). Ask before choosing one.
- The PRD sets no package versions. Ask before pinning one (OQ-20, OQ-21).
- The Prisma client cannot read or write vector columns. Vector reads and writes use Prisma raw queries in application code.
- Write migration files only when the owner asks for one. Never run them.
- Use no other AI framework or agent library.
- Time-based work runs in Inngest.
- Secrets live in Vercel environment variables. None are in the repository.
- Environment variable names are listed in PRD section 10, other decisions. Create no new variable without asking.

## Folder map
The PRD gives no folder paths. It names these routes and server modules.

Routes: /api/auth/* (sign-in, sign-out and auth server actions), /api/availability, /api/bookings/[ref]/status, /api/webhooks/paystack, /api/assistant, /api/support, /api/inngest, /staff/* (front desk and manager actions), /manager/* (manager actions).

Server actions named in PRD section 10: createBooking, rescheduleBooking, addAuthorization, revokeAuthorization.

Server modules: Auth module, Capacity service, Pricing service, Payments module, Email module, Assistant module, Inngest functions.

No folder layout is set. Ask the owner where each new file goes before creating it.

## How to work in this codebase
- One change means one requirement ID (FR or BR) per response. If the requirement is too large for one response, stop at a natural step, say what remains, and wait.
- The packages for the fixed stack and the PRD section 10 tools are pre-approved. Ask before adding, removing or upgrading any other package, including dev dependencies.
- Do not connect to, query, migrate or seed any database yourself. Write code and test files only. The owner runs every migration, seed script and test that needs a database.
- End every response with a section titled Assumptions. Write "none" if there are none.
- If PRD section 15 gives a default, use it and list it under Assumptions. If the PRD has no statement, stop and ask.

Rules the PRD states for all code:
- All money is NGN, stored as integer kobo, shown in naira. Add no tax or fee.
- Dates and cut-offs use Africa/Lagos. Service dates are plain dates. Timestamps are UTC (BR-037, an assumption).
- Recompute price on the server. Take role and owner id from the session, never from the request.
- On every protected request, read the role, active status and session version from the database and reject a mismatch.
- Every customer query includes the owner id on the server. Another customer's record returns 404.
- The server confirms a booking only after Paystack reports success, the currency is NGN, the amount equals the booking total and the reference belongs to that booking. A browser redirect never confirms a booking.
- Verify the Paystack signature on the raw body. Dedupe webhook events. Use an idempotency key on booking creation.
- Reserve all units for a booking in one all-or-nothing database transaction. The database enforces reserved at or below capacity (BR-011).
- Only the booking status transitions in PRD section 8.3 are allowed. The server rejects any other.
- A payment retry never extends the hold. A booking has one initiated payment at a time (BR-044).
- Hold expiry is allowed. No screen, API or job lets anyone cancel a booking or return money.
- Check-out needs a selected owner or active authorized person. A booking reference alone never enables check-out.
- Store the ID type only. Never store an ID number.
- The late-pickup penalty never reaches Paystack.
- Store and log no card data.
- Read prices from the price data. Never hard-code them or put them in assistant content (PRD 8.4, 9.1).
- The assistant has exactly two tools, availability and prices, both read-only. It refuses medical advice and booking changes. It has no access to private data.
- Rate limit abuse-prone endpoints and validate all input on the server (FR-046).
- Scrub emails, phone numbers and message text before sending to Sentry (FR-047).
- Outside production, send email only to the allowlist. Every email has a dedupe key (BR-036).
- Only the seed script sets a staff role. No API, page or request can set a role.
- The seed script must exist before the assistant is evaluated (FR-048).
- Automated tests must cover capacity concurrency, duplicate webhooks, hold expiry races and data isolation.
- Recommended by the PRD, not required: make no network call to Paystack, OpenAI or Resend inside a database transaction.

## Where the detailed rules live
The PRD is at the path the owner gives. Ask if you cannot find good-pets-prd-v2.md. No rules files exist yet. Ask the owner before creating one.
- User flows: section 5
- Functional requirements FR-001 to FR-049: section 7
- Data, statuses, price table and business rules BR-001 to BR-049: section 8
- AI assistant rules and evaluation set: section 9
- Architecture, data model and vector storage: sections 10, 10.1, 10.2 and 10.3
- Security, data isolation and permission matrix: section 11
- Business model and payment lifecycle: section 12
- Open questions and the default used for each: section 15
- Decisions required from the owner: section 16
- Acceptance criteria and test plan: section 17

Each PRD statement is labelled. CONFIRMED: build as written. ASSUMPTION: build the stated default and list it under Assumptions. RECOMMENDATION: build it only if a Version One requirement includes it. OPEN QUESTION: use the section 15 default, or ask if none.

## Definitions
- Version One: the MVP. Everything listed under Version One in PRD section 6.
- Customer: a pet owner with an account and a verified email.
- Size tier: the dog size band worked out from weight at booking. The boundaries are in BR-003. Cats have no size tiers.
- Priority tier: P0, P1 or P2 in PRD section 6. P0 is needed for the product to work. P1 is needed for the full portfolio story. P2 can be dropped.
- Hold: capacity reserved until the hold expiry time, which depends on the payment method (BR-017).
- Reconciliation: a background job that verifies stale pending payments with Paystack.
- Needs attention: the booking status for a verified late payment whose dates cannot be re-reserved. The manager list also shows duplicate and mismatched payments and failed emails.
- Cut-off window: the minimum number of Lagos calendar days before the first service date for a reschedule. It differs by service (BR-020).
- Reschedule: moving a confirmed booking to later dates with the same quantity and no price change. It is the only way a customer can change a booking's dates. There is no cancellation.
- Authorized pickup person: a person an owner registers for one booking.
- Collector: the person who collects the pet. It is the owner or an active authorized pickup person.
- Staff-assisted authorization: a collector registered by staff for an owner in an emergency. It needs a typed reason, is audited and emails the owner.
- Check-in record and check-out record: staff entries that mark a pet arriving and leaving. A check-out needs a selected collector and the ID type seen.
- Late pickup: staff judge a daycare pickup as after the closing time set in service settings. Staff tick it at check-out and the penalty is paid in cash at the desk.
- Booking reference: the unique code the server generates for each booking. Customers and staff use it to find a booking.
- Webhook: a message Paystack sends to the app when a payment event happens.
- Idempotency key: a key the client creates when checkout opens. Repeating a request with the same key and inputs returns the same booking.
- Audit log: an append-only record of sensitive actions. Only the manager can view it.
- Move booking: a manager action that sets new dates with the same quantity. It needs a reason, ignores the customer cut-off, and charges nothing.
- Seed script: creates service settings, price data, the two staff users and published starter knowledge documents in a fresh database.
- Evaluation set: a version-controlled list of test questions that a Vitest script runs against the assistant.
- Knowledge document: business content in draft or published state. Only published content is retrieved by the assistant.
- Chunk: a piece of a published knowledge document, split by heading and then by paragraph, prefixed with the document title and heading path, and stored with its vector for similarity search.
- RAG: retrieval-augmented generation. The assistant answers from retrieved published chunks and tool results.
- Closure: a date range with no new bookings. Existing bookings are not changed automatically.