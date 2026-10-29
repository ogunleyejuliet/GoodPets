---
trigger: glob
globs: "**/*{auth,session,permission,role}*.{ts,tsx}, **/api/auth/**, **/staff/**, **/manager/**, **/middleware.ts"
description: Sign-in, sessions, roles, passwords and data isolation for Good Pets.
---

# Auth and permissions

Job: who can sign in, who can do what, and how a customer is kept to their own data.

1. Use Auth.js with the Credentials provider and JWT sessions. Add no other sign-in method. Reason: social, phone and emailed sign-in links are out of scope.
2. Every protected page, route handler and server action calls one helper, `requireUser(roles?)`. It reads role, active status and session version from the database and rejects a mismatch. Reason: a JWT cannot be revoked, so this check makes deactivation and password resets take effect at once.
3. Treat middleware redirects as convenience only. Reason: they are not the security check.
4. Add a test that lists every protected route and fails if one does not call the helper (PRD 11.2). Reason: one forgotten route is a hole.
5. Every customer query includes the owner id from the session. Another customer's record returns 404, not 403 (BR-032). Reason: a 403 confirms the record exists.
6. Staff routes reject customers with 403. Manager-only actions reject front desk with 403. The PRD 11.7 permission matrix is the source. If it is silent, ask. Reason: front desk must never change prices, capacity or published content.
7. New accounts are CUSTOMER. Only the seed script or a database operation sets a staff role. No API, form or action accepts a role (BR-031). Reason: a role field in a request is a privilege escalation.
8. Staff sessions are shorter than customer sessions. The durations are in PRD section 11 (OQ-37). Reason: shared desk computers are higher risk.
9. Hash passwords with Argon2id. Ask which library before installing one (OQ-36). Reason: the choice must run on Vercel.
10. Passwords are 10 to 128 characters, with no composition rules, not on a bundled common list, and the confirm field must match (BR-046). Reason: length and a blocklist beat symbol rules.
11. Sign-up gives the same response whether or not the email exists. An existing email gets an "account exists" email and no second account (BR-045). Reason: it stops account enumeration.
12. Sign-in messages never reveal whether the email exists. Compare against a dummy hash for unknown emails. Block after 5 failures per 15 minutes per email or 20 per 15 minutes per IP (BR-049). Reason: this slows guessing and hides which accounts exist.
13. Email verification is required once. Unverified accounts cannot sign in, book or use customer features. Links last 24 hours and can be resent (BR-047). Reason: it proves the address is real without nagging every login.
14. Reset links last 1 hour, work once and are consumed when the form is submitted, not when the link opens. Reason: email scanners open links.
15. Store only a hash of each token, never the token. Reason: a database leak must not hand out working links.
16. A successful reset or a deactivation raises `sessionVersion` and sends a "password changed" email (BR-048). Reason: every older session must die.
17. Send verification and reset emails through the email module, not an Auth.js email provider. Reason: this project uses Credentials only.