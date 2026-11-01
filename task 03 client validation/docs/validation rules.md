#
## 1. Sign In Form (Login)

### 1.1 Email Address — Required Field
- **Field & Validation Rule:** Email input must not be empty or contain only whitespace. Displays inline error: `"This field must not be empty"`.
- **When Validation Triggers:** 
  - On input blur (`handleLoginEmailBlur` / `handleSignInEmailBlur`) when the field loses focus while empty.
  - On form submission (`handleLoginSubmit` / `handleSignIn`).
  - Clears immediately as the user begins typing valid content.
- **What Could Go Wrong Without the Rule:** 
  - Users submit an empty login form, resulting in avoidable network traffic to `/api/auth/signin` and confusing generic server rejection responses.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users tabbing rapidly through form fields before entering values will see an immediate red error outline and caution icon, which may feel premature before they have finished interacting.

### 1.2 Email Address — Format Validation
- **Field & Validation Rule:** Email must conform to a standard email format matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Displays inline error: `"Enter a valid email address"`.
- **When Validation Triggers:** 
  - Exclusively on form submission (`handleLoginSubmit` / `handleSignIn`) when the user attempts to log in with an invalid email address.
  - Does NOT trigger while typing an invalid email.
  - Does NOT trigger when moving focus from the email field to the password field (blur).
  - Clears as soon as the email format becomes valid.
- **What Could Go Wrong Without the Rule:** 
  - Typographical errors (e.g., missing `@` symbol or domain) trigger failed authentication round-trips and potential account sign-in throttling.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users with valid internationalized domain names (IDNs) or non-standard email syntaxes that fail the simplified regular expression.
  - Users pasting an email with accidental leading or trailing spaces (handled if trimmed, but may flag if whitespace is preserved).

### 1.3 Password — Required Field
- **Field & Validation Rule:** Password input must not be empty. Displays inline error: `"This field must not be empty"`.
- **When Validation Triggers:** 
  - On input blur when leaving the field empty.
  - On form submission.
  - Clears immediately as soon as a character is typed.
- **What Could Go Wrong Without the Rule:** 
  - Submitting an empty password triggers an unnecessary server authentication round-trip and server-side authentication error.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users who accidentally click or tab into the password field before entering their email address see an error before they attempt to type.

---

## 2. Sign Up Form (Account Creation)

### 2.1 Full Name — Required Field
- **Field & Validation Rule:** Full name must not be empty or whitespace only. Displays inline error: `"This field must not be empty"`.
- **When Validation Triggers:** 
  - On input blur (`handleSignUpNameBlur`).
  - On form submission (`handleSignUpSubmit` / `handleSignUp`).
  - Clears on change once input is entered.
- **What Could Go Wrong Without the Rule:** 
  - An account could be created without an identifiable owner name, making it impossible for front desk staff to confirm customer identity during pet drop-off and pickup.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users tabbing through the form before entering their details.

### 2.2 Full Name — Minimum Character Length
- **Field & Validation Rule:** Trimmed full name must be at least 2 characters long. Displays inline error: `"Full name must be at least 2 characters."`.
- **When Validation Triggers:** 
  - On input blur.
  - On form submission.
  - Clears when name length reaches $\ge 2$ characters.
- **What Could Go Wrong Without the Rule:** 
  - Accidental single-character inputs (e.g. initials, single letters, or stray keystrokes) could be submitted as legal names.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Individuals with legitimate single-letter mononyms (rare, but existing in some cultural contexts).

### 2.3 Full Name — Two Name Parts (Words)
- **Field & Validation Rule:** Full name must contain at least two distinct name parts separated by whitespace (e.g. "Juliet Ogunleye"). Handles leading, trailing, and multiple consecutive whitespace characters. Displays inline error: `"Please enter your full name (at least two names)."`.
- **When Validation Triggers:** 
  - On input blur.
  - On form submission.
  - Clears as soon as a second valid name part is entered.
- **What Could Go Wrong Without the Rule:** 
  - Users enter only a first name or nickname (e.g., "Ade"), creating ambiguity and verification risks for staff handling pet handovers when multiple customers share common first names.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Mononymous individuals who legally have only one name (common in parts of Indonesia, Myanmar, South India, and other regions).
  - Users who prefer not to disclose their surname or family name during initial registration.

### 2.4 Full Name — Maximum Character Length
- **Field & Validation Rule:** Trimmed full name must not exceed 100 characters. Displays inline error: `"Full name cannot exceed 100 characters."`.
- **When Validation Triggers:** 
  - On input blur.
  - On form submission.
- **What Could Go Wrong Without the Rule:** 
  - Excessively long names overflow database column limits, break mobile card layouts, or disrupt staff dashboard views.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Individuals with lengthy compound, traditional, or royal titles spanning several generational family names exceeding 100 characters.

### 2.5 Sign-Up Email — Required Field
- **Field & Validation Rule:** Email must not be empty or whitespace only. Displays inline error: `"This field must not be empty"`.
- **When Validation Triggers:** 
  - On input blur (`handleSignUpEmailBlur`).
  - On form submission.
  - Does *not* show before the user interacts with the field.
- **What Could Go Wrong Without the Rule:** 
  - Account created without contact information, preventing booking confirmation emails, rescheduling notices, and password reset deliveries.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users tabbing through form fields without typing.

### 2.6 Sign-Up Email — Format Validation
- **Field & Validation Rule:** Email must match standard email pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Displays inline error: `"Enter a valid email address"`.
- **When Validation Triggers:** 
  - When the user leaves the email field (blur), if the non-empty value is invalid.
  - On form submission (`handleSignUpSubmit` / `handleSignUp`), blocking submission if invalid.
  - Does NOT show an email format error while typing.
  - Clears immediately as soon as the email format becomes valid.
- **What Could Go Wrong Without the Rule:** 
  - Users enter malformed emails and submit, causing account creation failure, bounced verification emails, or unreachable accounts.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users with non-ASCII or newer top-level domain addresses that do not match standard regex patterns.

### 2.7 Sign-Up Password — Minimum Length & Inline Hint
- **Field & Validation Rule:** Password must be at least 8 characters in length. Displays inline error: `"Password must be at least 8 characters."`. An inline hint (`"Password must be at least 8 characters."`) is hidden by default and shown once typing begins.
- **When Validation Triggers:** 
  - Hint triggers: Appears inline as soon as the user starts typing (`value.length > 0`) and remains visible while typing.
  - Error triggers: On input blur if length is $< 8$, or on form submission.
  - Clears once password length reaches 8 characters.
- **What Could Go Wrong Without the Rule:** 
  - Weak, short passwords vulnerable to brute-force attacks compromising customer booking histories and pet records.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users with cognitive or memory difficulties who rely on shorter memorable passcodes and do not use password managers.

### 2.8 Confirm Password — Required and Match
- **Field & Validation Rule:** Confirm password must not be empty and must match the password field identically. Displays inline error: `"This field must not be empty"` if blank, or `"Passwords do not match."` if values differ.
- **When Validation Triggers:** 
  - On input blur (`handleSignUpConfirmPasswordBlur`).
  - On form submission.
  - Clears when inputs match.
- **What Could Go Wrong Without the Rule:** 
  - Users register with a mistyped password and immediately get locked out upon their next sign-in attempt.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users with password managers or autofill extensions that fill one field but fail to trigger change events in the other.
  - Users on mobile devices with obscured password fields who make minor typographical errors.

### 2.9 Terms and Conditions Acceptance
- **Field & Validation Rule:** The acceptance checkbox must be checked (`true`). Unchecked by default. Displays inline error: `"You must agree to the Terms and Conditions to create an account."`.
- **When Validation Triggers:** 
  - Evaluated continuously for button enablement.
  - Inline caution signal displays when the user attempts to submit or clicks the disabled Create Account button without accepting terms. It does not display prematurely while filling other fields.
- **What Could Go Wrong Without the Rule:** 
  - Customers register without acknowledging business policies, pet vaccination requirements, daycare collection cut-offs, or the no-refund rescheduling policy.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users with visual or motor impairments if accessibility attributes (`aria-invalid`, `aria-describedby`) are not announced by their screen readers.
  - Users who do not agree to specific clauses or who prefer to inspect the booking interface before agreeing to legal terms.

### 2.10 Create Account Button — Form Completeness Gate
- **Field & Validation Rule:** The "Create Account" submit button remains disabled (`disabled={!isSignUpFormValid || signUpLoading}`) until all required sign-up fields are valid and the Terms and Conditions checkbox is checked.
- **When Validation Triggers:** 
  - Computed reactively on every state change.
- **What Could Go Wrong Without the Rule:** 
  - Premature submissions produce unnecessary error round-trips and layout jumping.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users who rely on clicking the submit button to discover missing or invalid fields. When a button is disabled, clicking produces no native feedback, which can cause confusion if a user does not realize a specific requirement is unmet.

---

## 3. Password Reset Form (Reset)

### 3.1 Reset Email Address — Required and Format
- **Field & Validation Rule:** Email must not be empty and must match standard email format. Displays error: `"Email address is required."` or `"Please enter a valid email address."`.
- **When Validation Triggers:** 
  - On form submission (`handleResetSubmit`).
- **What Could Go Wrong Without the Rule:** 
  - Submitting blank or invalid emails triggers pointless reset token dispatch attempts on the server.
- **Which Legitimate Users Might Be Inconvenienced or Blocked:** 
  - Users who make a typo and must wait for submit-time validation rather than receiving earlier inline feedback.

---

## 4. Unconfirmed / Out-of-Scope Validation Behaviors

The following potential validation behaviors were inspected and confirmed **NOT** implemented in the client-side authentication code:
- **Character complexity for passwords:** No client-side uppercase, lowercase, number, or special symbol enforcement is applied (only length $\ge 8$).
- **Real-time blur on password reset:** Mode 3 (Reset) validates strictly upon submit, not on blur or real-time typing.
- **Email domain verification / duplicate checks:** Unique email constraints and existing account detection are handled asynchronously by the server API (`/api/auth/signup`) and cannot be validated client-side prior to submission.

