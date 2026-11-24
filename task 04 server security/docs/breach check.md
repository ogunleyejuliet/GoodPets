# Breached Password Screening

## Purpose

Prevent users from registering with passwords that have appeared in known data breaches.

## Implementation

GoodPets uses the Have I Been Pwned (HIBP) Passwords API with its k-anonymity model.

The screening process:

1. The application calculates the password's SHA-1 hash locally.
2. It sends only the first five characters of the hash to the HIBP API over HTTPS.
3. The API returns matching hash suffixes.
4. The application compares the remaining hash locally.
5. If a match is found, registration is rejected.

The original password and complete hash are never sent to HIBP.

The implementation also uses:
- `Add-Padding` to improve response privacy.
- A two-second timeout for the external request.
- Fail-closed behaviour when the screening service is unavailable.

## Signup Integration

Password screening runs during signup before password hashing and account/session creation.

The route handles two failure cases:

**Breached password — HTTP 400**

The user receives:

`This password has appeared in a known data breach. For your security, please choose a different password.`

**Screening service unavailable — HTTP 503**

The user receives:

`Password security screening is temporarily unavailable. Please try again shortly.`

Neither failure creates a user account or issues a session.

## Verification

The verification script is:

`node scratch/test-breached-password.js`

The test suite passed all 11 checks, covering:

- Detection of a known breached password.
- Acceptance of a clean password.
- Sending only the five-character hash prefix.
- Preventing transmission of the plaintext password or complete hash.
- Use of the `Add-Padding` header.
- Handling unsuccessful HTTP responses.
- Handling network and timeout errors.
- Handling malformed API responses.
- Rejection of breached passwords by the signup route.
- Returning an error when screening is unavailable.
- Confirming that failed screening does not create a user or issue a session.

The optional live verification was also run:

`node scratch/test-breached-password.js --live`

The live HIBP service check passed.

## Evidence

`15-breach-check-rejection.png`

This screenshot captures the actual signup request and HTTP 400 response when a known breached password is submitted.