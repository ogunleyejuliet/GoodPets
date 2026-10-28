---
trigger: always_on
---

description: Baseline security rules that apply to every change in any project.
---
# Security

Job: the baseline security rules for every change. Project-specific access rules live elsewhere.

1. Keep secrets out of the repository, the browser and the logs. Read them from server environment variables. Reason: a committed secret is leaked for good.
2. Validate every input on the server with a schema. Reject bad input with a 400. Reason: browser checks are advice, not protection.
3. Never trust identity, role, owner id, price or amount from the client. Take them from the session or the database. Reason: anything the client sends can be forged.
4. Check permission on the server for every protected action. Hiding a button is not a check. Reason: people call endpoints directly.
5. Send generic errors to the client and detailed errors to the error monitor. Reason: detailed errors teach attackers how the system works.
6. Never log, or send to a monitoring tool, passwords, tokens, card data, email addresses, phone numbers or message text. Scrub them before capture. Reason: logs travel far and many people can read them.
7. Rate limit every endpoint that anyone can call. Return 429 with a retry time. The limits are in the PRD (BR-039). Reason: abuse is cheap and a limit makes it costly.
8. Keep the least personal data you need. Reason: data you do not hold cannot leak.
9. Serve HTTPS only, send standard security headers and a basic Content-Security-Policy. Route handlers that change data need the session cookie and a same-origin check. Reason: this blocks cross-site request forgery.
10. Compare secrets and signatures in constant time. Reason: ordinary comparison leaks timing information.