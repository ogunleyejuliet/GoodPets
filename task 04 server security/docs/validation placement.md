# Server-Side Validation and Enforcement

## 1. Purpose

This document describes how Good Pets validates incoming data and enforces security-sensitive rules on the server.

Client-side validation improves the user experience, but it cannot be trusted as the only layer of protection. Requests can be sent directly to API endpoints without using the website interface.

Good Pets therefore performs validation and authorization checks on the server before processing sensitive operations.

## 2. Validation Library

Good Pets uses **Zod** for request validation.

The authentication validation schemas are defined in:

`src/lib/validations/auth.ts`

The signup route uses the schema to validate incoming registration data before creating an account.

## 3. Signup Validation

The signup schema validates the following fields:

| Field | Validation |
|---|---|
| Name | Trimmed and checked for minimum length |
| Full name | Must contain at least two names |
| Email | Normalized and validated as an email address |
| Password | Trimmed and must contain at least 8 characters |
| Confirm password | Trimmed and must match the password |
| Terms acceptance | Must explicitly be `true` |

Invalid requests are rejected before account creation.

The signup route uses Zod's `safeParse` to validate the request. Validation failures return HTTP 400 with an error response containing the first validation message and field-level errors.

Duplicate email addresses return HTTP 409.

## 4. Email and Password Normalization

Normalization is applied consistently during signup and signin.

### Email

- Leading and trailing whitespace is removed.
- Email addresses are converted to lowercase.
- The normalized email is used for account lookup and storage.

This prevents case variations from being treated as different email addresses.

### Password

- Leading and trailing whitespace is removed.
- The normalized password is used during hashing and verification.
- Internal spaces are preserved.

The same normalization rule is applied during signup and signin.

## 5. Terms Acceptance Enforcement

The server requires an explicit `agreeToTerms: true` value.

The server does not assume that a user accepted the terms simply because the frontend displayed a checkbox.

Requests that omit the field or submit `false` are rejected with HTTP 400.

Only requests containing `agreeToTerms: true` can proceed through signup validation.

## 6. Customer ID Enforcement During Signin

Customer accounts require a four-digit customer ID during signin.

The server checks that:

- The supplied customer ID has exactly four digits.
- The supplied ID matches the customer ID stored for the account.
- The check is performed by the server, not trusted to frontend validation.

Missing, malformed, or incorrect customer IDs result in a generic authentication failure.

The signin implementation also performs a dummy Argon2 operation for these failure cases to reduce timing differences.

Staff signin is exempt from the customer ID requirement.

## 7. Direct API Request Enforcement

Security rules must remain effective even when a request bypasses the website interface.

The implementation was tested using direct HTTP requests to the API.

The tests covered:

- Invalid signup data.
- Missing or false terms acceptance.
- Customer signin without a customer ID.
- Invalid customer ID formats.
- Incorrect customer IDs.

The server rejected invalid requests rather than relying on frontend controls.

## 8. Validation Placement

| Location | Responsibility |
|---|---|
| `src/lib/validations/auth.ts` | Defines signup validation rules |
| Signup API route | Validates registration data before account creation |
| Signin API route | Normalizes credentials and enforces customer ID requirements |
| Server-side authentication logic | Verifies credentials and controls access |

Validation belongs at the server boundary because API requests can be constructed independently of the frontend.

## 9. Evidence

The following evidence supports the implementation:

- `evidence/09-email-case-normalised.png` — demonstrates email normalization.
- `evidence/10-password-trim-working.png` — demonstrates password trimming.
- `evidence/11-validation-timing.txt` — records validation behaviour and timing evidence.
- `evidence/12-direct-request-before-and-after.txt` — documents direct-request testing and the server-side enforcement findings.

## 10. Conclusion

Good Pets uses Zod for structured signup validation and performs security-sensitive checks on the server. Email and password normalization are consistent across signup and signin. Terms acceptance and customer ID requirements are enforced by the API, preventing users from bypassing these rules by sending requests directly.