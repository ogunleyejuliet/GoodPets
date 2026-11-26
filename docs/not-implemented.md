# GoodPets — Deferred Security Controls & Threat Model Trade-offs

**Document:** `docs/not-implemented.md`  
**Application:** GoodPets Pet Care (Victoria Island, Lagos)  
**Phase:** Version One (MVP / Portfolio Release)  
**Status:** Approved Architecture Analysis  

---

## 1. Executive Summary

GoodPets enforces a robust baseline security architecture tailored for its Version One scope, including:
- **Password Security:** Argon2id hashing with OWASP-recommended parameters (64 MB memory, 3 iterations, 4 parallelism threads) and k-anonymity SHA-1 prefix checks against the HaveIBeenPwned API ([src/lib/auth-passwords.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/auth-passwords.ts), [src/lib/pwned-passwords.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/pwned-passwords.ts)).
- **Verification Integrity:** 6-digit numeric verification codes hashed with HMAC-SHA256 bound to user IDs, 10-minute expiry windows, single-use compare-and-swap (CAS) database consumption, and dummy HMAC evaluation to mitigate user enumeration timing attacks ([src/lib/tokens.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/tokens.ts)).
- **Credential Storage:** AES-256-GCM encryption of outbox token payloads in the database, with automatic payload purging upon successful email delivery ([src/lib/outbox.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/outbox.ts)).
- **Abuse Prevention:** Database-backed sliding-window rate limiting partitioned across client IP and email addresses, returning RFC-compliant HTTP 429 status codes with `Retry-After` headers ([src/lib/rate-limit.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/rate-limit.ts)).
- **Session Lifecycle:** JWT session versioning validated against `User.sessionVersion` in PostgreSQL, enabling global session invalidation on password reset ([prisma/schema.prisma](file:///c:/Users/hp/Desktop/GoodPets/prisma/schema.prisma)).
- **Information Protection:** Generic responses for unverified, existent, and non-existent email addresses on resend and password-reset endpoints to prevent account enumeration.

During the security threat modeling and architecture design phase for Version One, several advanced security controls were evaluated. To maintain development velocity, prevent scope creep, and align with the application's risk profile (single-location business operating Paystack in test mode), specific controls were deliberately deferred.

This document details five security controls considered, the rationale for deferring them, and the concrete business or architectural triggers that will necessitate their future adoption.

---

## 2. Deferred Security Controls

### Control 1: Multi-Factor Authentication (MFA / 2FA via TOTP & WebAuthn)

#### What it does
Multi-Factor Authentication requires users to present two or more independent authentication factors before obtaining an authenticated session. Typically implemented via Time-Based One-Time Passwords (TOTP, RFC 6238) through authenticator apps (e.g. Google Authenticator, 1Password) or FIDO2/WebAuthn hardware security keys, this control ensures that compromised credentials (e.g. via credential stuffing or phishing) alone are insufficient to hijack an account.

#### Why it is not implemented now
1. **Explicit Scope Boundary:** `AGENTS.md` and the PRD explicitly exclude customer-facing MFA and authenticator apps for staff in Version One (*"Authenticator-app codes for staff, unless the owner decides (OQ-22)"*).
2. **Current Threat Model:** GoodPets Version One operates Paystack payments strictly in test mode; no real financial settlement or bank transactions take place. Pet owner accounts only access booking history, pet care notes, and profile details.
3. **Operational Overhead:** Implementing MFA requires significant UX and operational infrastructure: enrollment QR-code flows, encrypted storage of TOTP shared secrets, backup recovery code generation, time-drift synchronization, lost-device manual recovery protocols, and support desk verification workflows.
4. **Staff Roles:** Staff accounts (`FRONT_DESK` and `MANAGER`) are strictly provisioned via seed scripts ([prisma/seed.ts](file:///c:/Users/hp/Desktop/GoodPets/prisma/seed.ts)) without public self-registration. Role checks are verified directly against the database on every protected request.

#### What would trigger adoption
- **Live Financial Transactions:** Upgrading Paystack from test mode to live production mode where card settlements, bank payouts, and manager-initiated transactions involve real capital.
- **Privileged Manager Exposure:** Exposing the `/manager/*` and `/staff/*` administrative dashboards over the public internet rather than restricted internal networks.
- **Regulatory / Industry Mandates:** Compliance with formal standards (such as PCI-DSS or NDPR high-risk tier processing) that require multi-factor authentication for administrative access to customer PII.

---

### Control 2: Automated CAPTCHA / Proof-of-Work Bot Mitigation on Public Endpoints

#### What it does
Challenges incoming requests on high-abuse public endpoints (such as `/api/auth/signup`, `/api/auth/resend-verification`, and `/api/auth/verify-email`) with interactive or invisible challenges (e.g., Cloudflare Turnstile, hCaptcha, or cryptographic client-side proof-of-work puzzles) to differentiate human users from automated botnets.

#### Why it is not implemented now
1. **Existing Layered Defenses:** Abuse is currently mitigated by:
   - Sliding-window database rate limits (e.g., 3 requests per 15 minutes for resend; 5 signups per hour per IP) implemented in [src/lib/rate-limit.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/rate-limit.ts).
   - Strict server-side Zod input validation in [src/lib/auth-validation.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/auth-validation.ts).
   - HaveIBeenPwned k-anonymity breach checks in [src/lib/pwned-passwords.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/pwned-passwords.ts).
   - `EMAIL_ALLOWLIST` filtering in non-production environments to prevent external email dispatch.
2. **User Experience & Conversion:** Traditional CAPTCHAs create friction, accessibility hurdles, and drop-off during onboarding for mobile pet owners.
3. **Architectural Simplicity & Privacy:** Avoids third-party tracking scripts, external network dependencies during rendering, and cookie banner complications.
4. **Agent Sandbox Compliance:** Automated testing pipelines and development agents cannot solve CAPTCHAs, and project rules forbid circumventing anti-bot challenges.

#### What would trigger adoption
- **Distributed Botnet Attacks:** High-volume credential stuffing or account creation floods using rotating residential proxies that evade IP-partitioned sliding-window rate limits.
- **Email Outbox Exhaustion / Denial of Wallet:** Bot syndicates weaponizing the verification or welcome email dispatch systems to exhaust transactional SMTP/Resend API quotas or degrade sender domain reputation.

---

### Control 3: Centralized Security Information and Event Management (SIEM) & Real-Time Alerting

#### What it does
Aggregates, parses, and normalizes audit logs, authentication outcomes, rate-limit violations, and state changes into a centralized log management and SIEM platform (e.g., Datadog Security Monitoring, Elastic Security, AWS CloudWatch Logs Insights). Employs automated correlation rules and anomaly detection algorithms to trigger real-time alerts (via PagerDuty, Slack, or webhook) upon detecting suspicious patterns (e.g., brute-force password attacks, sudden spikes in outbox creation, or unauthorized role transition attempts).

#### Why it is not implemented now
1. **Application Scale:** GoodPets currently runs as a single-instance Next.js deployment serving one physical location in Victoria Island, Lagos.
2. **Standardized Local Logging:** The application already implements structured, sanitized console logging across authentication and outbox pipelines:
   - Outbox events log status, outbox ID, and user ID while strictly redacting raw verification codes, passwords, and encryption keys ([src/lib/email.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/email.ts#L415), [src/lib/outbox.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/outbox.ts#L88)).
   - HTTP status codes, user IDs, and sanitized error messages are logged synchronously on every authentication route ([src/app/api/auth/signup/route.ts](file:///c:/Users/hp/Desktop/GoodPets/src/app/api/auth/signup/route.ts#L105), [src/app/api/auth/verify-email/route.ts](file:///c:/Users/hp/Desktop/GoodPets/src/app/api/auth/verify-email/route.ts#L102)).
3. **Error Monitoring Scope:** Exception tracking is slated for Sentry integration (with email and phone scrubbing per requirement FR-047), which covers crash diagnostics without the operational expense of an enterprise SIEM cluster.
4. **Cost & Maintenance:** Running a full SIEM cluster introduces substantial ongoing cloud expenditure and alert-triage overhead unnecessary for a prototype.

#### What would trigger adoption
- **Multi-Location Expansion:** Opening additional GoodPets daycare and boarding branches with dozens of simultaneous front-desk and manager operators across Nigeria.
- **Security Incident Response Requirements:** SLA commitments requiring sub-5-minute detection and containment of active brute-force or credential-stuffing campaigns.
- **Regulatory Audits:** Mandatory retention of centralized, tamper-evident audit trails for financial transactions and customer record modifications.

---

### Control 4: Automated Point-in-Time Recovery (PITR) & Cross-Region Database Replication

#### What it does
Maintains continuous archiving of PostgreSQL Write-Ahead Logs (WAL) alongside automated daily full-system snapshots, paired with streaming replication to an off-site geographical region. Enables Point-in-Time Recovery (PITR) to restore database state down to the exact second preceding data corruption, malicious tampering, or infrastructure failure.

#### Why it is not implemented now
1. **Development & Staging Focus:** In the current portfolio build phase, the database is a development PostgreSQL instance managed via Prisma migrations executed by the project owner ([prisma/schema.prisma](file:///c:/Users/hp/Desktop/GoodPets/prisma/schema.prisma)).
2. **Test Data Profile:** Current records consist of seed data, synthetic pet profiles, and test bookings. Data loss in development is mitigated by reproducible Prisma seed scripts ([prisma/seed.ts](file:///c:/Users/hp/Desktop/GoodPets/prisma/seed.ts)).
3. **Infrastructure Cost:** Automated WAL streaming, snapshot storage retention, and multi-region read replicas require dedicated managed cloud database tiers (e.g., AWS RDS Multi-AZ, Supabase Pro) that exceed the prototype's infrastructure requirements.

#### What would trigger adoption
- **Production Launch with Real Customers:** Transitioning to production where paying customers hold active boarding, daycare, and grooming reservations, and pet medical histories cannot be reconstructed from seed scripts.
- **Business Continuity SLAs:** Establishing an enterprise Recovery Point Objective (RPO) $\le 5$ minutes and Recovery Time Objective (RTO) $\le 30$ minutes in the event of cloud provider availability zone outages.

---

### Control 5: Customer-Facing Account Lockout Screens & Multi-Device Session Management UI

#### What it does
Monitors sequential authentication failures and places customer accounts into a locked state after $N$ failed attempts. Provides an account recovery unlock flow (e.g. emailed unlock tokens) and surfaces an in-app security dashboard where customers can inspect active browser sessions, IP locations, and device types, and selectively revoke older sessions.

#### Why it is not implemented now
1. **Explicit Exclusion in AGENTS.md:** The project specifications explicitly dictate:
   - *"Not in scope for the MVP: Account lock screens. Sign-in throttling is in scope."*
   - *"Screens for viewing or revoking sessions. A password reset still invalidates all older sessions."*
2. **Denial-of-Service Risk:** Hard account lockouts allow malicious actors to perform account-denial attacks by intentionally submitting incorrect passwords for known customer email addresses, locking legitimate pet owners out of their accounts.
3. **Existing Throttling & Invalidation:**
   - Sign-in attempts are throttled using the database-backed sliding-window rate limiter in [src/lib/rate-limit.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/rate-limit.ts), making automated brute-force attacks economically and computationally unviable without locking out the legitimate user.
   - Global session invalidation is natively implemented via `sessionVersion Int @default(1)` on the `User` model ([prisma/schema.prisma](file:///c:/Users/hp/Desktop/GoodPets/prisma/schema.prisma#L75)). A password reset increments this version, immediately invalidating all existing JWT sessions without needing a manual session revocation screen.

#### What would trigger adoption
- **Customer Feature Requests:** High customer demand for self-service security management (e.g., verifying which household members or devices are logged in).
- **High-Risk Identity Standards:** Specific customer security guidelines requiring formal account lockouts following consecutive credential failures.

---

## 3. Summary Comparison Matrix

| Security Control | Current GoodPets Defense | Deferred Implementation | Primary Trigger for Adoption |
|---|---|---|---|
| **Multi-Factor Auth (MFA / 2FA)** | Strong Argon2id passwords, breach checks, verified email codes | TOTP / WebAuthn hardware keys | Live Paystack payments, public manager dashboard exposure |
| **Bot Mitigation / CAPTCHA** | Sliding-window DB rate limiting, Zod schema validation, email allowlist | Cloudflare Turnstile, hCaptcha | Distributed proxy botnets, email outbox quota exhaustion |
| **Centralized SIEM & Alerting** | Structured, sanitized console logs, Sentry crash capture | Centralized ELK / Datadog SIEM, 24/7 alerting | Multi-facility nationwide expansion, strict compliance audits |
| **PITR & Cross-Region Replicas** | Reproducible Prisma migrations, database seed scripts | Continuous WAL archiving, multi-AZ streaming replicas | Production customer bookings, strict RPO/RTO disaster recovery SLAs |
| **Account Lockout & Session UI** | IP/Email rate throttling, global `sessionVersion` invalidation | Lockout screens, per-device session management UI | Customer self-service demand, enterprise security audit requirements |

---

## 4. Inspection & Codebase Audit Trace

The findings in this document were established by direct inspection of:
- [src/lib/auth-passwords.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/auth-passwords.ts): Argon2id hashing implementation and parameters.
- [src/lib/pwned-passwords.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/pwned-passwords.ts): HaveIBeenPwned k-anonymity SHA-1 API check.
- [src/lib/tokens.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/tokens.ts): Verification code generation, HMAC hashing, 10-minute expiry, and single-use CAS consumption.
- [src/lib/outbox.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/outbox.ts): AES-256-GCM payload encryption, atomic outbox claim locking, and payload purging upon delivery.
- [src/lib/rate-limit.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/rate-limit.ts): Sliding-window rate limiter utilizing PostgreSQL `RateLimitEvent` table.
- [src/lib/email.ts](file:///c:/Users/hp/Desktop/GoodPets/src/lib/email.ts): Direct SMTP delivery with Nodemailer, semantic token resolution, error categorization, and credential redaction.
- [prisma/schema.prisma](file:///c:/Users/hp/Desktop/GoodPets/prisma/schema.prisma): `User`, `AuthToken`, and `EmailOutbox` data models, `Role` enum, and `sessionVersion` field.
- [AGENTS.md](file:///c:/Users/hp/Desktop/GoodPets/AGENTS.md): "Not in scope for the MVP" specification governing authentication, lockouts, and staff roles.

---

## Assumptions

- GoodPets Version One operates Paystack in test mode without real monetary movements or chargeback liabilities.
- The PostgreSQL database operates on a development/staging tier where disaster recovery is supported by migration and seed files rather than multi-AZ cloud replication.
- Existing rate limiting and Argon2id parameters provide sufficient protection against non-distributed brute-force attacks during the initial release.
