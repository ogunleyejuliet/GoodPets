# Enumeration and Information Disclosure

## 1. Purpose

This document records the information disclosure risk identified in the Good Pets authentication forms and explains the usability trade-off involved in removing unnecessary input-format guidance.

## 2. Field Selected

**Field:** Customer ID

**Location:**
- `src/app/auth/page.tsx` — Sign In form
- `src/app/book/page.tsx` — Booking Step 4 Sign-In

The Customer ID is a four-digit numeric identifier used by customers to sign in.

## 3. Original Information Displayed

Before the change, the Customer ID field displayed:

- **Placeholder:** `e.g. 1001 or 3214`
- **Inline format error:** `Customer ID must be exactly 4 digits.`

These messages explicitly communicated the expected format and length of a valid Customer ID.

## 4. Information an Attacker Could Learn

The format guidance reveals that customer identifiers consist of exactly four numeric digits.

An attacker could learn that:
- Valid identifiers contain digits rather than letters or other characters.
- Every identifier has a fixed length of four digits.
- The possible numeric combinations range from `0000` to `9999`, giving a theoretical keyspace of 10,000 combinations.

An attacker could use this information to narrow their guesses when attempting to discover valid customer identifiers.

If the application also provides distinguishable responses for valid and invalid identifiers, the risk of customer enumeration increases.

The format hint alone does not prove that customer records can be enumerated successfully. Other protections, including rate limiting and generic authentication responses, also matter.

## 5. Changes Made

The explicit Customer ID format guidance was removed from the visible login interface.

The changes include:

- Removed the example `e.g. 1001 or 3214` from the placeholder.
- Removed the message `Customer ID must be exactly 4 digits.` from visible error feedback.
- Retained the Customer ID field.
- Retained the underlying four-digit validation and authentication behavior.
- Replaced specific login failure messages with the generic message: `Invalid Customer ID or password.`

The generic error is used whether the Customer ID is unknown or the password is incorrect. This prevents the login interface from revealing which credential was wrong.

## 6. Usability Trade-off

Removing the format guidance reduces the amount of information exposed to someone inspecting the login interface. However, it also makes the form less informative for legitimate customers.

Without an example or explicit length guidance, a customer may not know:

- Whether the Customer ID should contain four digits.
- Whether leading zeros are required.
- Whether the identifier should include a prefix.

This uncertainty may lead to failed login attempts, frustration, and additional support requests.

The generic error message also means customers receive less specific feedback when sign-in fails. They must check both their Customer ID and password rather than being told which one is incorrect.

The change therefore involves a trade-off between limiting information disclosure and helping legitimate customers complete authentication successfully.

## 7. Security Considerations

The interface changes do not replace server-side security measures.

The application should continue to:
- Validate Customer IDs on the server.
- Use the same generic response for unknown Customer IDs and incorrect passwords.
- Apply appropriate rate limiting to login attempts.
- Avoid exposing account existence through different error messages or response behavior.

## 8. Conclusion

The Customer ID field demonstrated how seemingly helpful format and length hints can disclose information about an application's identifier structure.

Removing the visible guidance and using a generic authentication error reduces information exposed through the login interface. However, it also creates usability costs for legitimate customers.

The underlying validation remains in place, and authentication security must continue to rely on appropriate server-side protections rather than the presence or absence of frontend hints.