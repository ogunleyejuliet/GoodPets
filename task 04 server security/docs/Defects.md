1. Fixed Defects

1.1 Password Whitespace Normalization

Identified during: Step 5 — Email and Password Normalization

Problem: Registration and sign-in did not consistently normalize passwords by trimming leading and trailing whitespace.

Fix: Updated signup and signin to use the trimmed password for password validation, hashing and verification. Passwords are not modified internally; only surrounding whitespace is removed.

Verification: Password normalization tests passed. Signup with surrounding password spaces returned HTTP 201.

Status: Fixed. Automated tests and registration endpoint test passed.

Evidence: evidence/10-password-trim-working.png

1.2 Single-Word Name Accepted

Identified during: Step 7 — Server-Side Enforcement

Problem: The server accepted single-word names even though the frontend required at least two name components.

Fix: Added server-side validation requiring at least two name components.

Verification: Direct signup request using Madonna returned HTTP 400.

Status: Fixed and verified.

Evidence: evidence/12-direct-request-before-and-after.txt

1.3 Terms and Conditions Agreement Not Enforced

Identified during: Step 7 — Server-Side Enforcement

Problem: The signup API did not require explicit agreement to the Terms and Conditions.

Fix: Added agreeToTerms to the server-side validation schema and included the checkbox value in frontend signup requests.

Verification:

Agreement omitted: HTTP 400.

Agreement false: HTTP 400.

Agreement true: HTTP 201.

Status: Fixed and verified.

Evidence: evidence/12-direct-request-before-and-after.txt

1.4 Customer ID Bypass During Sign-In

Identified during: Step 7 — Server-Side Enforcement

Problem: Customers could sign in without supplying the required four-digit customer ID.

Fix: Updated the sign-in API to require and verify the customer ID for customer accounts. Staff authentication remains exempt.

Verification:

Customer ID omitted: HTTP 401.

Correct customer ID supplied: HTTP 200.

Status: Fixed and verified.

Evidence: evidence/12-direct-request-before-and-after.txt