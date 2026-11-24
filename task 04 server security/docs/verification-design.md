# GoodPets — Email Verification Architecture & Security Design

## 1. Overview & Objectives

This document specifies the security architecture, cryptographic design, data lifecycle, and transport mechanisms for the customer email verification system in **GoodPets** (Victoria Island, Lagos, Nigeria), fulfilling the Task 4 (Server Security) Step 10 assessment requirements.

### Core Objectives
1. **Account Integrity:** Prevent unverified or unauthorized accounts from accessing pet booking and profile management.
2. **Cryptographic Randomness:** Generate unbiased, non-predictable 6-digit numeric verification codes using OS CSPRNG.
3. **Database Compromise Resilience:** Eliminate plaintext code exposure. Protect against offline brute-force attacks on the limited 6-digit space using server-side HMAC hashing bound to user context.
4. **Strict Expiry & Single-Use:** Enforce a strict 10-minute validity window on the server, invalidate previous codes upon resend, and prevent concurrency race-condition double-consumption.
5. **Standardized SMTP Transport:** Deliver emails using Nodemailer over TLS (port 465) via authenticated SMTP, separating code generation from email dispatch.
6. **Transactional Outbox Architecture:** Store encrypted email payloads transactionally alongside user creation to preserve consistency without blocking database transactions on third-party network calls.

---

## 2. Six-Digit Verification Code Generation & Cryptographic Randomness

### Implementation Details
- **Function:** `generateRawVerificationCode()` in `src/lib/tokens.ts`.
- **Entropy Source:** `crypto.randomInt(100000, 1000000)`.
- **Output:** Exactly 6 decimal digits formatted as a string (range: `100000` to `999999`).
- **Forbidden Methods:** `Math.random()` and sequential generators are strictly prohibited.

### Vulnerability Analysis: Why Predictable Codes Fail
- `Math.random()` in JavaScript engines (V8, JavaScriptCore) is implemented via pseudo-random number generators (such as xorshift128+) designed for speed, not cryptographic security.
- The internal seed state of `Math.random()` can be deduced after observing a small number of consecutive outputs (~5–10 samples).
- If verification codes were generated via `Math.random()`, an attacker observing one verification code (e.g. by registering their own test account) could predict subsequent codes generated for victim accounts, enabling account takeover without access to the victim's email inbox.
- Using `crypto.randomInt` draws directly from system entropy (e.g. `/dev/urandom` on Linux, `BCryptGenRandom` on Windows), guaranteeing uniform distribution and unpredictable outputs.

---

## 3. Secure Storage & HMAC Hashing

### The Threat of Limited Search Space ($10^6$)
A 6-digit numeric verification code has a finite keyspace of:
$$10^6 = 1,000,000 \text{ possibilities}$$

- If an attacker gains read access to the database (via SQL injection, leaked backup, or database dump), a plain, unsalted fast hash (such as MD5, SHA-1, or plain SHA-256) offers virtually zero protection.
- Precomputed lookup tables (rainbow tables) or brute-force engines (such as Hashcat) can calculate $1,000,000$ SHA-256 hashes in **less than 100 milliseconds** on a modern CPU or GPU, reversing every code instantly.

### GoodPets Protection Architecture: Bound HMAC-SHA256
To prevent offline attacks, GoodPets combines:
1. **Dedicated Server Secret:** `VERIFICATION_CODE_SECRET` (configured via environment variables with $\ge 32$ characters in production, distinct from `AUTH_SECRET` and `EMAIL_TOKEN_ENCRYPTION_KEY`).
2. **User Context Binding:** The HMAC input includes both the `userId` and the `rawCode`:
   $$\text{tokenHash} = \text{HMAC-SHA256}(\text{VERIFICATION\_CODE\_SECRET}, \text{userId} \mathbin{\Vert} \text{":"} \mathbin{\Vert} \text{rawCode})$$

### Security Properties Guaranteed:
- **No Global Rainbow Tables:** An attacker cannot precompute a dictionary because the HMAC requires the server secret, and each user's hash is distinct.
- **Cross-User Collisions Prevented:** Even if User A and User B receive the same 6-digit code at the same time, their `tokenHash` values are completely different because `userId` is bound into the message.
- **Preservation of Database Schema:** The 64-character hexadecimal HMAC string directly satisfies the existing `tokenHash String @unique` column on `AuthToken` without requiring migration of a separate salt column.
- **Plaintext Never Stored:** Neither the database nor server logs store the raw 6-digit code.

---

## 4. Lifecycle: Expiry, Single-Use & Concurrency Control

### 10-Minute Expiry Justification
- Unlike password reset links (which may have longer windows), a 6-digit code has an inherently compact search space.
- A **10-minute expiry window** limits the attack surface for online brute-force guessing and ensures stale codes cannot be used hours or days later.
- Expiry is enforced on the server in database queries: `expiresAt > NOW()`.

### Invalidation of Older Codes & Same-Code Reissuance
- Per PRD FR-002, issuing a new verification code immediately invalidates older unconsumed codes for that user.
- Older active codes are invalidated:
  `UPDATE "AuthToken" SET "expiresAt" = NOW() - INTERVAL '1 second' WHERE "userId" = :userId AND "purpose" = 'EMAIL_VERIFICATION' AND "usedAt" IS NULL`
- If a newly generated code happens to match a previous code for the same user, an atomic `upsert` (`ON CONFLICT (tokenHash) DO UPDATE`) refreshes the expiration window to 10 minutes and resets `usedAt` to `null`. This prevents any unique constraint collision (P2002) and preserves database foreign key references.

### Atomic Concurrency Control (CAS)
To guarantee that two simultaneous requests cannot double-spend or bypass verification:
1. An atomic conditional update is executed:
   ```sql
   UPDATE "AuthToken"
   SET "usedAt" = NOW()
   WHERE "userId" = :userId
     AND "tokenHash" = :tokenHash
     AND "purpose" = 'EMAIL_VERIFICATION'
     AND "usedAt" IS NULL
     AND "expiresAt" > NOW();
   ```
2. Row-level write locks in PostgreSQL ensure that exactly one concurrent transaction updates `count = 1`.
3. The winner proceeds to update `User.emailVerified = NOW()`.
4. The loser receives `count = 0` and is rejected with `TokenReusedError` (HTTP 409).

---

## 5. Transactional Outbox Architecture

### Transactional Guarantees
- Customer registration (`POST /api/auth/signup`) executes inside an atomic `prisma.$transaction`.
- In a single database transaction, the server creates:
  1. `User` (with unique 4-digit `customerId`).
  2. `AuthToken` (storing only `tokenHash`).
  3. `EmailOutbox` (storing AES-256-GCM encrypted payload).
- If any write fails, all records roll back, preventing orphan user records without tokens or tokens without users.

### Encryption at Rest (AES-256-GCM)
- The raw 6-digit verification code stored in `EmailOutbox.encryptedPayload` is encrypted using AES-256-GCM.
- A fresh 96-bit random IV is generated for each record:
  $$\text{encryptedPayload} = \text{ivHex} \mathbin{\Vert} \text{":"} \mathbin{\Vert} \text{authTagHex} \mathbin{\Vert} \text{ciphertextHex}$$
- Encrypted using `EMAIL_TOKEN_ENCRYPTION_KEY` (32 bytes).
- Raw codes are never stored in plaintext in the outbox table.

---

## 6. SMTP Delivery & Failure Handling

GoodPets uses **Nodemailer** over authenticated SMTP.

### Environment Configuration
| Variable | Description | Production Requirement | Tested Local Value |
| :--- | :--- | :--- | :--- |
| `SMTP_HOST` | Hostname of SMTP server | Valid SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Port for SMTP traffic | 465 (SSL) or 587 (TLS) | `465` |
| `SMTP_SECURE` | Boolean TLS flag | `true` for 465 | `true` |
| `SMTP_USER` | Authenticated mailbox user | Valid mailbox address | Configured in `.env.local` |
| `SMTP_PASS` | Application-specific password | Secure app password | Configured in `.env.local` |
| `EMAIL_FROM` | Display sender address | Branded sender | `Good Pets <...>` |
| `EMAIL_ALLOWLIST` | Recipient allowlist in non-prod | Domain or email filter | Configured |

### Failure Isolation & Error Categorization
- SMTP dispatch during signup is asynchronous and non-blocking: network delays or SMTP service disruptions do not block or roll back user account creation.
- Delivery errors are categorized:
  - **Retryable (transient):** Connection timeouts (`ETIMEDOUT`), socket disconnects (`ECONNRESET`, `ESOCKETTIMEDOUT`), and 4xx SMTP responses.
  - **Permanent (non-retryable):** Authentication failures (535), 5xx mailbox rejections, or malformed email syntax.
- If SMTP fails during signup dispatch, the outbox record remains `PENDING` with the encrypted payload intact for background worker retry.

---

## 7. Sign-in Enforcement & Unverified-Account Gating

### Customer Gating
- `POST /api/auth/signin` enforces verification for customer accounts (FR-003, BR-047).
- If `user.role === 'CUSTOMER'` and `!user.emailVerified`:
  - Returns HTTP 403 Forbidden with `{ success: false, code: 'EMAIL_NOT_VERIFIED', error: 'Verify your email first.', verificationUrl: '/auth/verify' }`.
  - Strictly prevents session token signing or `goodpets_session` cookie creation.
- Rate-limiting rules (BR-049) apply to failed sign-in attempts.

### Staff Role Exemption
- Per PRD specifications, internal staff accounts (`role === 'FRONT_DESK'` and `role === 'MANAGER'`) are initialized via the database seed script and are exempt from customer email verification checks.

---

## 8. Customer Journey & Booking Resumption

### Registration (Flow A & Flow B)
1. Customer registers via `POST /api/auth/signup`.
2. Password hashed with Argon2id; Customer ID generated (4 digits).
3. 6-digit code generated and hashed with HMAC.
4. Database transaction writes `User`, `AuthToken`, and `EmailOutbox` atomically.
5. Async non-blocking SMTP dispatch sends initial email.
6. Server returns HTTP 201; **strictly no session cookie is issued**.

### Verification (`/auth/verify`)
1. Customer enters email and 6-digit code into accessible form.
2. Form submits to `POST /api/auth/verify-email`.
3. Server validates format (`/^\d{6}$/`), computes HMAC with user ID, and marks `emailVerified`.
4. Returns HTTP 200 with success confirmation; **does not auto-login**.

### Booking Resumption (Flow A)
- Booking selections are retained in the original tab's React state and `sessionStorage`.
- Customer verifies email in a second tab or device, returns to the original booking tab, and clicks *"Already verified? Sign in here"*.
- Customer signs in with password and Customer ID.
- Wizard resumes at **Step 4 (Pet Selection)** with full selections intact.
- Capacity is strictly reserved only at **Step 7 (Checkout)** via `POST /api/bookings`.

---

## 9. Current Limitations & Deferred Work

The following features belong to later stages and are intentionally deferred:
1. **Stage 6 (Resend Flow):** Resend verification code endpoint (`POST /api/auth/resend-verification`) with rate limiting (3/hr per email) and anti-enumeration protections.
2. **Stage 7 (Inngest Worker):** Inngest background job processing (`inngest/send-verification-email`) with exponential backoff retries, dead-letter handling, and nightly purging of unverified customer records older than 7 days.
