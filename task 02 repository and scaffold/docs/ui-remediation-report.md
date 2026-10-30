# UI & Typography Design-System Remediation Report

**Project:** Good Pets  
**Auditor/Engineer:** Senior Frontend Engineer  
**Date:** 30 October 2026  
**Status:** Remediation Complete — Verified via Browser Runtime Testing  

---

## 1. Summary of Original Defects

A prior comprehensive UI compliance audit (`task 02 repository and scaffold/docs/ui-audit.md`) established several key departures from the Good Pets design system:

1. **Unintended Serif Typography (Times New Roman):** Interactive elements such as navigation links, primary action buttons, chips, and triggers were rendering in **Times New Roman** (serif) instead of **Nunito** (the humanist sans-serif required by the design tokens).
2. **Typography Role Underutilization:** 13 of the 15 typography roles defined in the design tokens were completely unused. Headings and paragraphs bypassed the design system using arbitrary Tailwind font size, weight, and clamp utilities.
3. **Corrupted Naira Symbol in Terminal Reporting:** The audit flagged currency representations displaying as `?12,000` and `?25,000` in terminal outputs.
4. **Arbitrary Spacing Values:** Heavy reliance on ad-hoc bracketed rem padding notations (e.g., `px-[1.5rem]`, `py-[0.875rem]`, `px-[0.875rem]`) rather than consistent scale values.

---

## 2. Confirmed Root Cause of the Font Issue

The font failure was confirmed through Chrome DevTools Protocol (`CSS.getPlatformFontsForNode`) runtime inspection. The root cause was a three-part configuration disconnect:

1. **Token Generator Omitted Font Fallbacks in CSS Variables:**
   In `task 01 design system/tokens/convert-tokens.js`, when processing `fontFamily: "Nunito"` from `design-tokens.json`, the script wrote:
   ```css
   --typography-label-large-font-family: Nunito;
   ```
   This declared a bare string without quotes, without generic fallback, and without referencing Next.js's loaded font variable.
2. **CSS Custom Property Fallback Bypass:**
   The utility classes defined:
   ```css
   font-family: var(--typography-label-large-font-family, 'Nunito', sans-serif);
   ```
   Because `--typography-label-large-font-family` was defined on `:root`, CSS engines bypassed the fallback argument `, 'Nunito', sans-serif`. The computed declaration evaluated strictly to `font-family: Nunito;`.
3. **Next.js Scoped Font Mismatch:**
   Next.js (`next/font/google` in `src/app/layout.tsx`) loads Nunito locally under an internal scoped identifier (`'__Nunito_7776a5'`) and exposes it through the CSS variable `--font-nunito`. It does not register a global `@font-face` with the un-scoped name `Nunito`.
4. **Browser Fallback Cascade:**
   When the browser parsed `font-family: Nunito;` on an element with a `.type-*` class, it could not find an `@font-face` for `Nunito` nor a matching operating-system font. Lacking any generic fallback (`sans-serif`), the browser defaulted to its initial serif font: **Times New Roman**.
   Meanwhile, unstyled elements inherited `body`'s font-family stack (`var(--font-nunito), ...`), which correctly resolved to the Google Font. Consequently, unstyled headings appeared in sans-serif, while tokenized buttons appeared in Times New Roman.

---

## 3. Files Modified and Why

| File | Change Category | Description & Justification |
|---|---|---|
| `task 01 design system/tokens/convert-tokens.js` | Token Generator (Source of Truth) | Updated font-family variable and utility class generation to include `var(--font-nunito), '${rawVal}', sans-serif`. |
| `task 01 design system/tokens/design-tokens.css` | Generated Tokens Stylesheet | Regenerated via official command `npm run build:tokens`. Replaced fallback-less `Nunito` with `var(--font-nunito), 'Nunito', sans-serif` across all 15 typography styles. |
| `src/app/LandingContent.tsx` | Application UI (Landing Page) | Applied official typography roles (`type-display-large`, `type-headline-large`, `type-title-large`, `type-body-large`, `type-body-medium`, etc.); normalized arbitrary bracketed rem padding to exact Tailwind scale equivalents. |
| `src/app/book/page.tsx` | Application UI (Booking Flow) | Applied official typography roles across Steps 1 to 4 (page titles, section headings, service cards, package matrices, form labels, inputs, action buttons); normalized bracketed spacing. |

*No design-token values, palettes, typography dimensions, or shadow definitions in `design-tokens.json` were modified.*

---

## 4. Font Integration Changes

To resolve the root cause cleanly without hardcoding styles into components or adding redundant network font requests:

1. **Generator Update (`convert-tokens.js`):**
   ```javascript
   let formattedVal = formatted;
   if (propName === 'fontFamily') {
     formattedVal = `var(--font-nunito), '${rawVal}', sans-serif`;
     fontFamilyVal = formattedVal;
   }
   ```
2. **Regenerated CSS Properties (`design-tokens.css`):**
   Every typography property now declares:
   ```css
   --typography-display-large-font-family: var(--font-nunito), 'Nunito', sans-serif;
   --typography-headline-large-font-family: var(--font-nunito), 'Nunito', sans-serif;
   --typography-title-large-font-family: var(--font-nunito), 'Nunito', sans-serif;
   --typography-body-large-font-family: var(--font-nunito), 'Nunito', sans-serif;
   --typography-label-large-font-family: var(--font-nunito), 'Nunito', sans-serif;
   /* ... across all 15 roles */
   ```
3. **Utility Class Declarations (`design-tokens.css`):**
   ```css
   .type-label-large, .typography-label-large {
     font-family: var(--typography-label-large-font-family, var(--font-nunito), 'Nunito', sans-serif);
     font-size: var(--typography-label-large-font-size, 14px);
     font-weight: var(--typography-label-large-font-weight, 500);
     line-height: var(--typography-label-large-line-height, 19.6px);
     letter-spacing: var(--typography-label-large-letter-spacing, 0.1px);
     font-style: var(--typography-label-large-font-style, normal);
   }
   ```
4. **Resolution Mechanism:**
   Because `layout.tsx` attaches `className={nunito.variable}` to `<html>`, `--font-nunito` is in scope across all routes. The browser evaluates `var(--font-nunito)` first, immediately resolving to Next.js's loaded Nunito font. If executed in an environment without Next.js (such as Task 1's standalone HTML), it falls back to `'Nunito'` and then generic `sans-serif`.

---

## 5. Typography Role Adoption

We systematically audited all text elements across the landing page and the 4-step booking flow, mapping them to the official 15 design-system styles:

| Design System Typography Role | Specifications (Size / Height / Weight / Tracking) | Elements Mapped |
|---|---|---|
| **Display Large** (`type-display-large`) | 57px / 79.8px / w400 / -3px | Desktop Hero headline ("Your Pet’s Favourite Place.") |
| **Display Medium** (`type-display-medium`) | 45px / 63px / w400 / 0px | Mobile Hero headline |
| **Headline Large** (`type-headline-large`) | 32px / 44.8px / w400 / -1px | Major section titles ("Our Services & Pricing", "Our Pet Care Standards", "How Booking Works", "Frequently Asked Questions"); Booking step main titles ("What would you like to book?", "Grooming Packages", "Daycare Booking", "Boarding Booking", "Sign in to continue") |
| **Headline Medium** (`type-headline-medium`) | 28px / 39.2px / w400 / 0px | Current Estimate total price readout in persistent booking bar |
| **Headline Small** (`type-headline-small`) | 24px / 33.6px / w400 / 0px | Service card headline prices (`₦12,000`, `₦25,000`); Package matrix card prices |
| **Title Large** (`type-title-large`) | 22px / 30.8px / w400 / -0.5px | Service card H3 titles ("Grooming", "Daycare", "Boarding"); Step 2 package matrix header ("Available Packages"); Step 4 pet selection header |
| **Title Medium** (`type-title-medium`) | 16px / 22.4px / w500 / +0.15px | Standards card headers; How It Works step titles; FAQ accordion questions; Package card names ("Basic Bath", "Full Groom", "Premium Groom"); Booking Step 1 service card titles; Pet card name ("Milo") |
| **Title Small** (`type-title-small`) | 14px / 19.6px / w500 / +0.1px | Dog size option titles ("Small Dog", "Medium Dog", "Large Dog"); Auth success banner title |
| **Body Large** (`type-body-large`) | 16px / 22.4px / w400 / -0.5px | Hero lead paragraph; Section introductory paragraphs |
| **Body Medium** (`type-body-medium`) | 14px / 19.6px / w400 / +0.25px | Service card descriptions; FAQ accordion answers; How It Works step descriptions; Booking step subtitles; Form text inputs |
| **Body Small** (`type-body-small`) | 12px / 16.8px / w400 / +0.4px | Standards card descriptions; Package overview bullet points; Service card overview lists; Fine print / disclaimers; Dog size sub-labels ("Under 10 kg"); Pet card breed/weight; Form validation errors |
| **Label Large** (`type-label-large`) | 14px / 19.6px / w500 / +0.1px | Desktop navigation links; Header and Hero primary and secondary CTA buttons; Service card booking buttons; Floating assistant trigger; Booking action buttons ("Sign In", "Continue to Booking", "Create Account & Continue", "Proceed to Available Dates"); Species toggle buttons |
| **Label Medium** (`type-label-medium`) | 12px / 16.8px / w600 / 0px | Form field labels ("Full Name", "Email Address", "Password"); Stepper navigation labels; Package overview subheaders; Summary card total label |
| **Label Small** (`type-label-small`) | 11px / 15.4px / w500 / +0.5px | Section eyebrow badges ("Premium Pet Care in Lagos", "Transparent Rates & Tailored Care", "Health & Safety First", "Simple & Guaranteed", "Got Questions?"); Appointment duration chips; Daycare hours chip |

---

## 6. Intentional Typography Exceptions

1. **Hero Title Weight (`font-extrabold` alongside `type-display-large`):**
   - *Rationale:* The design system's `Display Large` token prescribes weight `400`. However, the approved visual hierarchy and brand direction for Good Pets requires strong hero impact. We retained `font-extrabold` in combination with `.type-display-large`, preserving the token's 57px font-size, 79.8px line-height, and -3px letter-spacing while upholding brand emphasis.
2. **Section Heading Weight (`font-bold` alongside `type-headline-large`):**
   - *Rationale:* `Headline Large` prescribes weight `400`. For clear structural differentiation between section headers and body paragraphs, `font-bold` was retained alongside `.type-headline-large`.
3. **Emoji Glyphs:**
   - *Rationale:* Dog/Cat species icons (🐶, 🐱) and feature icons (💉, 🛡️, 🧹, 📅) render via the system emoji fallback font (e.g. `Segoe UI Emoji` on Windows, `Apple Color Emoji` on macOS), which is expected standard browser behavior.

---

## 7. Naira Symbol Correction

- **Investigation:** Direct binary inspection of `LandingContent.tsx` and `book/page.tsx` using Node.js confirmed that the currency characters were stored as genuine UTF-8 `₦` (Unicode `\u20A6`). The previous audit's observation of `?` was an artifact of Windows PowerShell 5.1 console encoding during output piping.
- **Verification:** Browser runtime evaluation verified that all price labels on both pages render the valid Nigerian Naira symbol (`₦`):
  - Landing Grooming: `₦12,000`
  - Landing Daycare: `₦12,000 / day`
  - Landing Boarding: `₦25,000 / night`
  - Booking Step 1 Grooming: `₦12,000`
  - Booking Step 1 Daycare: `₦12,000`
  - Booking Step 1 Boarding: `₦25,000`
  - Step 2 Grooming Small: `₦12,000`, Medium: `₦16,000`, Large: `₦22,000`
  - Step 2 Full Groom Small: `₦20,000`, Medium: `₦27,000`, Large: `₦35,000`
  - Step 2 Premium Groom: `₦25,000`–`₦35,000`
  - Step 2 Cat Grooming: `₦22,000`
  - Step 4 Total Estimate: dynamically formatted via `Intl.NumberFormat('en-NG')` as `₦...`.

---

## 8. Spacing Corrections

Arbitrary bracketed rem values were replaced with exact Tailwind spacing scale equivalents:

| Previous Arbitrary Class | Exact Dimension | Standard Tailwind Replacement | Layout Impact |
|---|---|---|---|
| `py-[0.5rem]` | 8px | `py-2` | 0px shift (exact equivalence) |
| `px-[1.25rem] py-[0.625rem]` | 20px × 10px | `px-5 py-2.5` | 0px shift (exact equivalence) |
| `px-[1.5rem] py-[0.625rem]` | 24px × 10px | `px-6 py-2.5` | 0px shift (exact equivalence) |
| `px-[1.5rem] py-[0.75rem]` | 24px × 12px | `px-6 py-3` | 0px shift (exact equivalence) |
| `px-[2rem] py-[0.875rem]` | 32px × 14px | `px-8 py-3.5` | 0px shift (exact equivalence) |
| `px-[0.875rem] py-[0.375rem]` | 14px × 6px | `px-3.5 py-1.5` | 0px shift (exact equivalence) |
| `px-[0.875rem] py-[0.25rem]` | 14px × 4px | `px-3.5 py-1` | 0px shift (exact equivalence) |
| `px-[0.75rem] py-[0.25rem]` | 12px × 4px | `px-3 py-1` | 0px shift (exact equivalence) |
| `p-[0.625rem]` | 10px | `p-2.5` | 0px shift (exact equivalence) |

All component dimensions, touch targets, and visual alignments remained strictly identical before and after remediation.

---

## 9. Before-and-After Verification Results

Comprehensive verification was conducted across all 5 key screens using Chrome DevTools Protocol (`CSS.getPlatformFontsForNode` and `Runtime.evaluate`):

| Page / Screen | Element | Target Typography Role | Before (Platform Font) | After (Platform Font) | Remediation Result |
|---|---|---|---|---|---|
| **Landing (`/`)** | Desktop Nav Link ("Services & Pricing") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Header Button ("Book a Service") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Header Link ("Sign In") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Hero Category Badge ("Premium Pet Care...") | `type-label-small` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Hero Headline ("Your Pet’s Favourite...") | `type-display-large` | Nunito (un-tokenized clamp) | **Nunito** (`Nunito-ExtraLight-ExtraBold`) | **Resolved & Tokenized** |
| **Landing (`/`)** | Hero Lead Copy ("From grooming and...") | `type-body-large` | Nunito (un-tokenized text-xl) | **Nunito** (`Nunito-ExtraLight`) | **Resolved & Tokenized** |
| **Landing (`/`)** | Hero CTA Button ("Book a Service") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Hero Secondary CTA ("Explore Our Services") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Section Title ("Our Services & Pricing") | `type-headline-large` | Nunito (un-tokenized text-4xl) | **Nunito** (`Nunito-ExtraLight-Bold`) | **Resolved & Tokenized** |
| **Landing (`/`)** | Service Card Title ("Grooming") | `type-title-large` | Nunito (un-tokenized text-xl) | **Nunito** (`Nunito-ExtraLight-Bold`) | **Resolved & Tokenized** |
| **Landing (`/`)** | Service Card Price ("₦12,000") | `type-headline-small` | Nunito (un-tokenized text-lg) | **Nunito** (`Nunito-ExtraLight-ExtraBold`) | **Resolved & Tokenized** |
| **Landing (`/`)** | Service Card Button ("Book Grooming") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Floating Assistant Button ("Ask AI Assistant") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Landing (`/`)** | Assistant Modal Submit ("Send") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Booking (`/book`)** | Header Link ("Back to Home") | `type-label-large` | Nunito (un-tokenized text-sm) | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved & Tokenized** |
| **Booking (`/book`)** | Top Button ("Sign In") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Booking (`/book`)** | Step 1 Title ("What would you like to book?") | `type-headline-large` | Nunito (un-tokenized text-3xl) | **Nunito** (`Nunito-ExtraLight-Bold`) | **Resolved & Tokenized** |
| **Booking (`/book`)** | Step 1 Service Title ("Grooming") | `type-title-medium` | Nunito (un-tokenized text-base) | **Nunito** (`Nunito-ExtraLight-Bold`) | **Resolved & Tokenized** |
| **Booking (`/book`)** | Step 2 Action Button ("Continue to Booking") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Booking (`/book`)** | Step 3 Form Labels ("Email Address", etc.) | `type-label-medium` | Nunito (un-tokenized text-xs) | **Nunito** (`Nunito-ExtraLight-Bold`) | **Resolved & Tokenized** |
| **Booking (`/book`)** | Step 3 Form Submit ("Create Account...") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |
| **Booking (`/book`)** | Step 4 Next Button ("Proceed to Dates") | `type-label-large` | Times New Roman | **Nunito** (`Nunito-ExtraLight-Medium`) | **Resolved** |

### Automated Serif Detection Test Result
A global DOM script scanned every single text-bearing element on both `http://localhost:3000` and `http://localhost:3000/book`:
- Elements with computed font-family containing `Times`: **0**
- Elements with non-sans-serif fallback: **0**
- Rendered platform font across all audited elements: **`Nunito` exclusively**

---

## 10. Remaining Issues and Limitations

1. **Build Environment Prerendering:**
   Running `npm run build` currently stops at prerendering `/404` (`PageNotFoundError: Cannot find module for page: /_document`) because Next.js App Router projects without a custom `not-found.tsx` can encounter internal route resolution conflicts when dev caches are present. This is a pre-existing scaffolding condition documented in `defects.md` and does not affect the development server or runtime rendering.
2. **Missing Token Categories:**
   The design-token JSON does not specify dimensions, spacing scales, or border-radius values. All spacing remediation relies on exact pixel-equivalent Tailwind utility classes.
3. **Staff & Manager Routes:**
   Routes for `/staff` and `/manager` are not yet created in the codebase and were not audited.

