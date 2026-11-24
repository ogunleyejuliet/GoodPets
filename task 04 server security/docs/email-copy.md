# GoodPets — Email Verification Copy & Template Specification

## 1. Purpose

Document the branding, template design, accessibility requirements, and exact copy used for Good Pets 6-digit email verification notifications delivered via SMTP.

---

## 2. Brand Context & Semantic Tokens

Good Pets utilizes a design-token architecture where components and templates consume semantic colour roles and typography tokens rather than raw primitive color codes:

- **Business Name:** Good Pets
- **Location:** Victoria Island, Lagos, Nigeria
- **Service Offering:** Premium dog and cat grooming, daycare, and boarding
- **Design System Semantic Roles Consumed:**
  - **Primary Actions & Brand Header:**
    - Header Background: `var(--color-primary)` (Role: `primary`)
    - Header Text: `var(--color-on-primary)` (Role: `on-primary`)
    - Header Subtitle: `var(--color-primary-container)` (Role: `primary-container`)
    - Code Display Border & Text: `var(--color-primary)` (Role: `primary`)
  - **Surfaces & Backgrounds:**
    - Canvas / Body Background: `var(--color-background)` (Role: `background`)
    - Card Container: `var(--color-surface)` (Role: `surface`)
  - **Text & Headings:**
    - Headings & Primary Text: `var(--color-on-surface)` (Role: `on-surface`)
    - Secondary / Disclaimers / Footer Text: `var(--color-on-surface-variant)` (Role: `on-surface-variant`)
  - **Borders & Dividers:**
    - Card Border, Dividers, & Notice Border: `var(--color-outline-variant)` (Role: `outline-variant`)
  - **Accent & Status Messaging:**
    - Security Notice Container: `var(--color-success-container)` (Role: `success-container`)
    - Security Notice Text: `var(--color-on-success-container)` (Role: `on-success-container`)
  - **Typography:**
    - Font Family: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
    - Code Box: Monospace font with letter spacing for readability.

---

## 3. Security Requirements Reflected in Copy

1. **10-Minute Expiration:** Explicitly stated in both HTML and plain-text bodies.
2. **Single-Use Code:** Explicit notice that the code can only be used once.
3. **Unsolicited Registration Warning:** Explicit statement that if the recipient did not initiate registration, no account is activated and the message can be safely ignored.
4. **No Raw Sensitive Data:** Plain-text passwords, session secrets, or internal user IDs are never included in email copy.

---

## 4. Email Metadata

- **Sender Address:** Configured via `EMAIL_FROM` (e.g. `Good Pets <...>` from `.env.local` or `.env`).
- **Subject:** `Your Good Pets Verification Code: {{code}}`
- **Delivery Transport:** Direct authenticated SMTP using Nodemailer (over TLS / port 465).

---

## 5. Plain-Text Copy

```text
Good Pets — Victoria Island, Lagos
========================================

Hello {{name}},

Thank you for registering with Good Pets. To activate your account and start booking grooming, daycare, or boarding for your pets, please enter the six-digit verification code below:

VERIFICATION CODE: {{code}}

IMPORTANT SECURITY DETAILS:
- Single-use code: This verification code can only be used once.
- 10-minute expiry: This code will expire in exactly 10 minutes.

If you did not register for a Good Pets account, please disregard this message. No account will be activated without verification.

--
Good Pets Pet Care
Victoria Island, Lagos, Nigeria
Automated security notification. Please do not reply to this email.
```

---

## 6. HTML Copy & Layout Structure

The HTML template is responsive (max width 580px) and renders cleanly across real email clients (Gmail, Apple Mail, Outlook). Semantic tokens are resolved from `design-tokens.json` and inlined onto element `style` attributes:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email — Good Pets</title>
</head>
<body style="margin: 0; padding: 0; background-color: {{theme.background}}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: {{theme.onSurface}}; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: {{theme.background}}; padding: 32px 16px;">
    <div style="max-width: 580px; margin: 0 auto; background-color: {{theme.surface}}; border-radius: 12px; border: 1px solid {{theme.outlineVariant}}; overflow: hidden;">
      <div style="background-color: {{theme.primary}}; padding: 28px 32px; text-align: center;">
        <h1 style="color: {{theme.onPrimary}}; font-size: 24px; font-weight: 700; margin: 0;">Good Pets</h1>
        <div style="color: {{theme.primaryContainer}}; font-size: 13px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Victoria Island &bull; Lagos</div>
      </div>
      <div style="padding: 32px;">
        <h2 style="font-size: 20px; font-weight: 700; color: {{theme.onSurface}}; margin-top: 0; margin-bottom: 16px;">Verify Your Email Address</h2>
        <p style="font-size: 15px; line-height: 1.6; color: {{theme.onSurface}}; margin-bottom: 20px;">
          Hello {{name}},
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: {{theme.onSurface}}; margin-bottom: 24px;">
          Thank you for registering with Good Pets. To activate your account and book grooming, daycare, or boarding for your pets, please enter this six-digit verification code:
        </p>
        
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: {{theme.primary}}; background-color: {{theme.background}}; border: 2px dashed {{theme.primary}}; border-radius: 12px; padding: 16px 28px; font-family: monospace;">
            {{code}}
          </div>
        </div>

        <div style="background-color: {{theme.successContainer}}; border-left: 4px solid {{theme.primary}}; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
          <strong style="color: {{theme.onSuccessContainer}}; font-size: 14px; display: block; margin-bottom: 6px;">Important Security Details:</strong>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: {{theme.onSuccessContainer}}; line-height: 1.6;">
            <li><strong>Single-use code:</strong> This code can only be used once.</li>
            <li><strong>10-minute expiry:</strong> This code expires in exactly 10 minutes.</li>
          </ul>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: {{theme.onSurfaceVariant}}; margin-top: 24px;">
          If you did not register for a Good Pets account, please disregard this email. No account will be activated without this code.
        </p>
      </div>
      <div style="background-color: {{theme.surface}}; border-top: 1px solid {{theme.outlineVariant}}; padding: 24px 32px; text-align: center; font-size: 12px; color: {{theme.onSurfaceVariant}}; line-height: 1.5;">
        Good Pets Pet Care &bull; Victoria Island, Lagos, Nigeria<br>
        Automated security notification. Please do not reply directly to this email.
      </div>
    </div>
  </div>
</body>
</html>
```
