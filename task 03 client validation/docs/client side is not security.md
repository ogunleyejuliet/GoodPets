# Client-Side Validation Is Not Security

## 1. Purpose

Client-side validation improves the user experience by helping users identify and correct invalid information before submitting a form. However, it is not a security control because requests can be sent directly to an application's API without using the browser interface.

For Good Pets, I tested the signup endpoint directly to determine whether the server independently enforces validation rules.

## 2. Direct Request Test

**Endpoint:** `POST /api/auth/signup`

**Testing method:** Windows PowerShell using `Invoke-WebRequest`.

The signup endpoint accepts a JSON payload containing:

- `name`
- `email`
- `password`
- `confirmPassword`

I sent two requests directly to the endpoint, bypassing the signup form.

### Test 1: Invalid name

I submitted a one-character name (`A`) with an eight-space password.

**Actual response: HTTP 400**

```json
{
  "success": false,
  "error": "Full name must be between 2 and 100 characters."
}
```

**Finding:** The server rejected the invalid name independently of the frontend. This demonstrates that server-side name validation is active.

### Test 2: Whitespace-only password

I submitted a valid name (`Test Customer`), a unique email address, and a password containing eight spaces. The confirmation password contained the same eight spaces.

**Actual response: HTTP 201**

```json
{
  "success": true,
  "user": {
    "id": "cmvyc7bvr0000tpycx4lwlcwp",
    "name": "Test Customer",
    "email": "direct-test-20261101222311@example.com",
    "role": "CUSTOMER",
    "createdAt": "2026-11-01T21:23:29.894Z"
  }
}
```

**Finding:** The server accepted the whitespace-only password and created the account. This exposed a weakness in the server-side password validation.

## 3. Which Client-Side Rules Were Enforced?

The direct requests bypassed the browser form, so frontend validation was not responsible for either result.

The server independently enforced the name-length check in the first request. However, it did not adequately enforce the password rule in the second request.

The endpoint checks whether the password contains at least eight characters using its length. It does not check whether those characters contain anything other than whitespace.

Therefore, the direct request exposed a gap between the intended password validation and what the server actually enforces.

## 4. What This Proves About Client-Side Validation and Security

Client-side validation is useful for immediate feedback, accessibility and preventing avoidable mistakes during normal form submission. It helps cooperative users provide information in the expected format.

However, users and automated tools are not required to use the interface. They can construct HTTP requests and submit data directly to the backend.

Consequently, frontend validation cannot be trusted to protect the database or enforce business rules. The server must independently validate every incoming request before processing or storing the data.

The Good Pets tests demonstrate both sides of this distinction: the server correctly rejected an invalid name, but accepted a whitespace-only password and created an account.

## 5. What I Will Do in Task 4

In Task 4, I will address the password-validation weakness at the server boundary.

The server-side signup validation should reject passwords consisting entirely of whitespace, while preserving the intended minimum-length requirement. I will also ensure that the backend remains responsible for enforcing the application's registration rules, regardless of whether a request comes from the browser form or another HTTP client.

I will test the corrected endpoint directly again to verify that the invalid password is rejected by the server, rather than relying only on the frontend.

## 6. Conclusion

The direct-request investigation confirmed that client-side validation is not security.

The first request returned HTTP 400 because the server rejected the one-character name. The second returned HTTP 201 because the server accepted a password made entirely of spaces and created an account.

These results identify a specific server-side validation weakness that must be addressed in Task 4. Both outcomes have been recorded honestly, without presenting the successful account creation as a validation success.