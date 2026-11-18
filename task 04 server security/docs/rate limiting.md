# Database-Backed Rate Limiting

## 1. Purpose

This document describes the rate-limiting implementation added to Good Pets as part of Task 4: Server Security and Data Integrity.

Rate limiting restricts how frequently clients can perform sensitive operations. It helps reduce automated abuse, brute-force attempts, and excessive API requests.

Good Pets uses PostgreSQL-backed rate limiting rather than relying solely on an in-memory counter.

## 2. Implementation

The shared rate-limiting implementation is located in:

`src/lib/rate-limit.ts`

It uses the existing PostgreSQL `RateLimit` table.

The table was created in:

`prisma/migrations/1_capacity_and_bookings/migration.sql`

Its fields are:

| Field | Purpose |
|---|---|
| `key` | Primary key identifying a rate-limit counter |
| `windowStart` | Start of the rate-limit window |
| `count` | Number of requests recorded in the window |

The implementation uses atomic database operations and transactions to maintain counters safely when requests arrive concurrently.

## 3. Rate Limits

The following limits are implemented:

| Operation | Limit | Window |
|---|---:|---|
| Signup | 5 requests per IP | 1 hour |
| Signin | 5 requests per normalized email and 20 per IP | 15 minutes |
| Availability | 60 requests per IP | 1 minute |
| Booking creation | 10 requests per user and 20 per IP | 1 hour |

Booking creation also retains the existing maximum of two active pending holds per customer.

## 4. Privacy-Preserving Rate-Limit Keys

Rate-limit keys are generated using HMAC-SHA256 with a purpose-specific prefix.

The implementation does not store raw email addresses, user identifiers, or IP addresses as rate-limit keys.

Purpose separation prevents the same underlying value from producing interchangeable keys across different rate-limiting contexts.

The HMAC secret is sourced from `AUTH_SECRET`, which must be at least 32 characters long.

## 5. IP Address Handling

In production, the implementation uses `x-vercel-forwarded-for` as the trusted IP source.

It validates that the header contains exactly one valid IP address. Missing, malformed, or ambiguous values are rejected.

The implementation does not trust `x-forwarded-for`, `x-real-ip`, or `x-test-client-ip` in production.

In development and test environments, test-compatible headers are supported, with a loopback fallback.

## 6. Atomic Reservations and Rollback

The shared implementation reserves rate-limit capacity through database transactions.

For operations with multiple counters, the keys are processed in a consistent sorted order.

If any required limit is exceeded, the transaction rolls back the speculative increments. This prevents a failed multi-counter reservation from consuming capacity in only some counters.

The implementation also provides `decrementRateLimits()` to release reservations when an operation should not consume the rate limit.

For example:

- Successful signin releases its own reservation.
- Failed signin attempts retain their counts.
- Failed booking creation releases its reservations.
- Successful booking creation retains its counts.

Database errors fail closed rather than allowing an unprotected request to proceed.

## 7. Retry Behaviour

When a request exceeds its configured limit, the API returns HTTP 429 (Too Many Requests).

The response includes a `Retry-After` value to indicate when the client may retry.

The retry calculation uses PostgreSQL's `NOW()` so that the rate-limit window is evaluated against the database clock.

## 8. Timezone-Safe Reservation Decrement

During database testing, the scoped decrement test exposed an implementation defect.

The `RateLimit.windowStart` column is a PostgreSQL `TIMESTAMP(3)` without timezone, while the JavaScript Date parameter was bound as `timestamptz`.

A comparison between these types could fail when the database session timezone was not UTC.

The correction in `src/lib/rate-limit.ts` explicitly converts the parameter to UTC before comparing it with the stored timestamp:

```sql
AND "windowStart" = (${item.windowStart}::timestamptz AT TIME ZONE 'UTC');
```

After the correction, the scoped decrement test successfully reduced the counter from 5 to 4.

## 9. Testing and Verification

The implementation was tested using:

`node scratch/test-rate-limits.js --unit`

`node scratch/test-rate-limits.js --db`

The final verification reported:

- 14/14 unit checks passed.
- 4/4 live database checks passed.
- Single-counter limit, retry calculation, and rollback passed.
- Concurrent reservations and atomic cross-counter rollback passed.
- Scoped decrement passed.
- HMAC key privacy checks passed.
- TypeScript check passed using `npx tsc --noEmit`.

Additional regression checks passed:

- Customer ID tests: 7/7.
- Signin customer ID tests: 8/8.
- Signup integration tests: 15/15.

The final verification therefore reported 48 passing checks across these test suites.

## 10. Performance Measurements

The final recorded database test run reported:

| Operation | Average | Maximum |
|---|---:|---:|
| Single upsert (3 measurements) | 110.39 ms | 324.34 ms |
| Concurrent multi-counter transaction (8 measurements) | 87.95 ms | 177.20 ms |

These are local test measurements, not production performance guarantees.

## 11. Cleanup and Limitations

A cleanup helper is available to delete rate-limit rows older than 24 hours.

An automated nightly Inngest cleanup job has not yet been implemented.

Other potential rate-limited operations, including password reset, verification resend, support, and assistant requests, were not included in this implementation.

The additional BR-042 limit of three active holds per IP was also deferred.

## 12. Evidence

The following evidence supports the implementation:

- `evidence/13-rate-limit-triggered.png` — demonstrates the rate-limit response.
- `evidence/14-rate-limit-defeated.txt` — records the database test results, concurrency checks, rollback behaviour, HMAC checks, and timezone-related fix.

## 13. Conclusion

Good Pets uses PostgreSQL-backed rate limiting with transactional reservations, privacy-preserving HMAC keys, and rollback support. The implementation was tested against unit and live database scenarios, including concurrent requests and timezone-sensitive decrement behaviour.

The remaining cleanup automation and deferred endpoint limits are documented rather than represented as completed features.