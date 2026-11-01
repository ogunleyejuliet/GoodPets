# Good Pets Accessibility Audit

This accessibility audit examines the Sign In, Sign Up, and Password Reset forms across `src/app/auth/page.tsx` and the booking wizard authentication step in `src/app/book/page.tsx`.

## 1. Audit Findings

| Item | Issue Summary | Affected Component / File | Audit Category |
|---|---|---|---|
| 1 | Disconnected error and missing caution icon in Password Reset | Auth Page (Reset Mode) | Error Association and Icons |
| 2 | Server and authentication error banners lack live regions | Auth Page and Booking Page | Screen-Reader Feedback |
| 3 | Dropped password hint association during error state | Booking Auth Step (Sign-Up) | Error Association |
| 4 | Missing visible focus and active state on mode selector tabs | Auth Page and Booking Page | Focus Visibility and State |
| 5 | Interactive link nested in checkbox label and unannounced new window | Auth Page and Booking Page | Keyboard and Label Semantics |

## 2. Detailed Audit Findings

### Issue 1: Missing Programmatic Association, Invalid State, and Caution Icon on Password Reset Email

**Location:** `src/app/auth/page.tsx` (Password Reset Form)

**Categories affected:** Error association, screen-reader announcements, colour independence and caution icon.

- The input `#auth-reset-email` lacked `aria-invalid` and `aria-describedby`.
- The error message had no ID, `role="alert"`, or caution icon.
- Screen-reader users were not informed that the field was invalid or that an error had occurred.
- Users with low vision or colour blindness lacked the visual caution indicator used on other form fields.

**Recommended correction:**
- Add `aria-invalid` and `aria-describedby` to the input.
- Give the error message an ID and `role="alert"`.
- Include the `CautionIcon` component.

### Issue 2: Server-Level Authentication Error Banners Lack Live Region Semantics

**Location:**
- `src/app/auth/page.tsx`
- `src/app/book/page.tsx`

**Category affected:** Screen-reader announcements.

- Authentication error banners were rendered without `role="alert"` or `aria-live="assertive"`.
- Success messages lacked `role="status"` and `aria-live="polite"`.
- Decorative emoji symbols were not hidden from assistive technologies.

**Recommended correction:**
- Add appropriate live-region attributes to error and success messages.
- Add `aria-hidden="true"` to decorative emoji symbols.

### Issue 3: Incomplete Multi-ID Association on Sign-Up Password Field in Booking Flow

**Location:** `src/app/book/page.tsx` (Booking Sign-Up Password)

**Categories affected:** Error association and screen-reader announcements.

The password field used a conditional expression that dropped the password hint reference when a validation error appeared. This meant users could lose access to the persistent password requirement when the field was in an error state.

**Recommended correction:**

Combine the password hint and error IDs in `aria-describedby`, keeping both available when applicable.

### Issue 4: Missing Keyboard Focus Rings and Active State Semantics on Mode Selector Tabs

**Location:**
- `src/app/auth/page.tsx`
- `src/app/book/page.tsx`

**Categories affected:** Focus visibility, keyboard accessibility and screen-reader announcements.

- The mode selectors lacked visible keyboard focus styling.
- The active Sign In or Create Account mode was not communicated through appropriate accessibility attributes.

**Recommended correction:**
- Add visible `focus-visible` styling.
- Add `aria-current` to the auth page links.
- Add `aria-pressed` to the booking page mode selector buttons.

### Issue 5: Interactive Link Nested Inside Checkbox Label and Unannounced New Window

**Location:**
- `src/app/auth/page.tsx`
- `src/app/book/page.tsx`

**Categories affected:** Keyboard accessibility and screen-reader announcements.

- The Terms and Conditions link was nested inside the checkbox label.
- This could cause confusion when users attempted to activate the link independently.
- The link opened a new tab without announcing this to screen-reader users.

**Recommended correction:**
- Separate the interactive link from the checkbox label.
- Add a screen-reader-only announcement that the link opens in a new tab.

## 3. Before-Fixes Screen-Reader Transcript

**Environment:** NVDA with Google Chrome  
**Test stage:** Before accessibility fixes

| Timestamp | Screen-reader output |
|---|---|
| 0:00 | Pet Salon in Lagos. |
| 0:03 | Julipri favor Good Pets services and pricing. Your pet's favourite place. |
| 0:11 | From grooming and play, from grooming and playful daycare to comfortable overnight stays, we make... |
| 0:16 | Sign in. Good Pets. Premium pet care in Lagos. |
| 0:22 | Access your pet profiles and booking reservations. Create account. Create account. Join Good Pets to book grooming, daycare and... |
| 0:29 | Boarding in Lagos. Sign-in form landmark. Full Name, edit. |
| 0:40 | Email Address, edit. [Email and field announcement partially unclear.] Alert: Enter a password. Password. |
| 0:53 | [Partially unclear.] Enter a valid password. Enter a valid email address. |
| 0:58 | Alert. This field. [Unclear announcement.] Stop loading this page. Good Pets Premium. Create account. |
| 1:07 | Full Name, form landmark. Full Name, edit. Example: Juliette Ogunleye. Blank. [Autocomplete announcement.] |
| 1:21 | Email Address, edit. [Email announcement partially unclear.] |
| 1:30 | Alert: Enter a valid email address. Enter a valid email address. |
| 1:34 | Password, edit, protected. [Autocomplete announcement.] At least eight characters. Password masked. |
| 1:43 | Confirm Password. Confirm Password, edit, protected. Password masked. |
| 1:55 | I agree to the Terms and Conditions. Good Pets Premium. I agree to the... [Announcement partially unclear.] |
| 2:03 | Create account. Sign in here. [Remaining announcement partially unclear.] Enter a valid email address. Password must... Confirm password. |

## 4. Accessibility Fixes and Verification

All five confirmed accessibility findings were implemented across `src/app/auth/page.tsx` and `src/app/book/page.tsx`.

### Test 1: Password Reset Error Fix

**Target:** `src/app/auth/page.tsx` (Password Reset Form)

- [x] Input has `aria-invalid`.
- [x] Input has `aria-describedby` referencing the error.
- [x] Error container has `id="auth-reset-email-error"`.
- [x] Error container has `role="alert"`.
- [x] Error container includes the semantic `CautionIcon`.
- [x] Old unannounced plain paragraph removed.

### Test 2: Authentication Feedback Live Regions

**Targets:** Auth page and booking wizard authentication feedback.

- [x] Login success message has `role="status"` and `aria-live="polite"`.
- [x] Login error message has `role="alert"` and `aria-live="assertive"`.
- [x] Sign-up success message has `role="status"` and `aria-live="polite"`.
- [x] Sign-up error message has `role="alert"` and `aria-live="assertive"`.
- [x] Booking authentication success message has `role="status"` and `aria-live="polite"`.
- [x] Booking authentication error has `role="alert"` and `aria-live="assertive"`.
- [x] Decorative emoji symbols have `aria-hidden="true"`.

### Test 3: Booking Sign-Up Password Multi-ID Description

**Target:** `src/app/book/page.tsx` (`#signup-password`)

- [x] Password hint ID is included when the hint is visible.
- [x] Password error ID is included when an error exists.
- [x] Both IDs are joined so the hint reference is not dropped when an error occurs.

### Test 4: Mode Selectors Keyboard Focus and Active State

**Targets:** Auth page and booking wizard mode selectors.

- [x] Sign In link has the correct `aria-current` state.
- [x] Create Account link has the correct `aria-current` state.
- [x] Auth page selectors have visible keyboard focus styling.
- [x] Booking Sign In button has the correct `aria-pressed` state.
- [x] Booking Create Account button has the correct `aria-pressed` state.
- [x] Booking selectors have visible keyboard focus styling.

### Test 5: Terms Checkbox Label Separation and New Window Announcement

**Targets:** Auth page and booking wizard terms checkboxes.

- [x] Terms link is not nested inside the checkbox label on the auth page.
- [x] Auth checkbox label is correctly associated with its input.
- [x] Auth terms link announces that it opens in a new tab.
- [x] Terms link is not nested inside the checkbox label on the booking page.
- [x] Booking checkbox label is correctly associated with its input.
- [x] Booking terms link announces that it opens in a new tab.
- [x] Activating the Terms link does not toggle the checkbox.

## 5. Static Analysis and Lint Verification

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Passed — 0 errors |
| ESLint | `npm run lint` | Passed — 0 warnings and 0 errors |

**Implementation verification result:** All five fixes were confirmed by Antigravity's automated accessibility assertions and static analysis.

## 6. After-Fixes Screen-Reader Transcript

**Environment:** NVDA with Google Chrome  
**Test stage:** After accessibility fixes

| Timestamp | Screen-reader output |
|---|---|
| 0:00 | Make a happy goal. Create account. Sign in. |
| 0:02 | Create account. |
| 0:04 | Good Pets. Premium pet care in Lagos. Google Chrome window. Good Pets. |
| 0:12 | Sign in. |
| 0:13 | Access your pet profiles and booking reservations. Sign in. |
| 0:19 | Create account. Create account. Visited link. Same page. Current page. |
| 0:28 | Full Name. |
| 0:32 | Form landmark. Full Name, edit. |
| 0:36 | Alert: Please enter your full name, at least two names. Please enter your full name, at least two names. |
| 0:43 | Alert: This field. [Partially unclear.] |
| 0:47 | Email Address, edit. [Partially unclear field announcement.] Good Pets Premium pet care in Lagos. Google Chrome. |
| 0:53 | [Unclear announcement.] Good Pets Premium pet care in Lagos. Document. Form landmark. |
| 0:59 | Email Address, edit. Has autocomplete. [Email value partially unclear.] Password, edit, protected. |
| 1:05 | Good Pets Premium. [Partially unclear announcement.] Confirm Password, edit, protected. |
| 1:13 | Password must be at least eight characters. Alert: Passwords do not match. [Partially unclear.] |
| 1:19 | Password, edit. [Partially unclear announcement.] Blank. |
| 1:23 | Num Lock on. Password masked. |
| 1:30 | Confirm Password, edit. Password masked. |
| 1:32 | [Password masked announcement.] Alert. |
| 1:37 | You must agree to the terms and conditions to create an account. |
| 1:45 | I agree to the checkbox. Not checked. Invalid entry. You must agree to the terms and conditions to create an account. Create account. |
| 1:53 | Create account button. Creating account. Alert: An account with this email address already exists. |
| 2:02 | Please sign in instead. |

## 7. Before-and-After Comparison

The two screen-reader tests show changes in how the authentication form communicates field requirements, validation errors and account feedback.

| Area | Before fixes | After fixes |
|---|---|---|
| Full Name validation | Validation announcements included "Enter a valid email address" and other field errors. | NVDA announced "Please enter your full name, at least two names." |
| Password requirements | Password hint was announced, but the booking flow could drop its association when an error occurred. | Password requirement "Password must be at least eight characters" was announced. |
| Password errors | Password and validation announcements were present, but the hint and error association was incomplete. | NVDA announced "Passwords do not match." |
| Terms acceptance | Terms text was announced, but the checkbox and nested link structure could cause interaction confusion. | NVDA announced the checkbox state and the requirement to agree to the terms before creating an account. |
| Account feedback | The before transcript included validation errors, but did not capture the existing-account response. | NVDA announced "An account with this email address already exists" and "Please sign in instead." |

The after-fixes recording shows the password requirement, password mismatch, terms acceptance requirement and existing-account response being announced during the test.

## 8. Files Modified

- `src/app/auth/page.tsx`
- `src/app/book/page.tsx`
- `task 03 client validation/docs/accessibility-audit.md`

## 9. Evidence

- `task 03 client validation/evidence/11 screenreader before.mp4`
- `task 03 client validation/evidence/12 accessibility verification.txt`
- `task 03 client validation/evidence/12-screenreader-after.mp4` — after-fixes screen-reader recording, if saved under this filename.

## 10. Conclusion

The accessibility audit identified five issues affecting error association, screen-reader feedback, keyboard focus, active-state communication and checkbox-label structure.

All five findings were confirmed and addressed in the authentication pages. TypeScript and ESLint checks passed, and Antigravity's automated assertions confirmed the expected accessibility attributes and markup.

The after-fixes screen-reader test demonstrated announcements for the full-name requirement, password requirement, password mismatch, terms acceptance requirement and existing-account feedback.

The before-and-after transcripts document the screen-reader experience across the authentication form before and after the implementation.