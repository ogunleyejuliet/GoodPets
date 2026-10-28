---
trigger: glob
globs: "**/*{payment,paystack}*.{ts,tsx}" "**/api/webhooks/paystack/**" "**/api/bookings/**/status/**" "**/*reconcil*.{ts,tsx}"
---

description: Paystack initialize, return page, webhook, retry and reconciliation rules.
---

# Payments with Paystack

Job: how money events are started, verified and recorded. Booking status changes belong to `booking-and-capacity.md`.

1. Use Paystack test mode and test keys only. Reason: no real money may move in this project.
2. Keep the secret key on the server. Never send it to the browser. Reason: a leaked key lets anyone act as the business.
3. Commit the hold first, then call Paystack initialize. Send the booking total in kobo, currency NGN, the customer email, the callback URL and only the channel the customer chose. Time out after 10 seconds. On failure the booking stays held and the page offers "Try again" (FR-014). Reason: the customer must not pay for a place that is not held.
4. If Paystack returns an expiry time for a bank transfer account number, set `holdExpiresAt` to it (BR-017). Reason: the account number stops working at that time.
5. Store no card data. Store only these webhook fields: event, reference, transaction id, status, amount, currency, channel, paid time and gateway response. Never store customer, authorization, card or bank fields (FR-016). Reason: card data in our systems brings legal duties we do not want.
6. A browser redirect never confirms a booking. The return page ignores any status in the URL, reads the status from the server, polls every 3 seconds for up to 60 seconds, then shows "We are still confirming your payment" (FR-015). Reason: anyone can forge a redirect.
7. Confirm only when Paystack reports success, the currency is NGN, the amount equals the booking total and the reference belongs to the booking (BR-015). Then call the shared confirmation function. Never write booking status from this module. Reason: one owner for status changes keeps races out.
8. Webhook: read the raw body and verify the `x-paystack-signature` header (HMAC SHA-512 with the secret key) before parsing. Reason: a parsed body no longer matches the signed bytes.
9. Webhook replies: an invalid signature returns 401 and nothing is stored as processed. A duplicate returns 200 and does nothing further. An unknown reference returns 200 and is logged. A verify API failure returns 500 so Paystack retries. Reason: each reply tells Paystack whether to try again.
10. Store each webhook event with a dedupe key, and confirm the dedupe key format against Paystack documentation (OQ-18). Reason: the same event arrives more than once.
11. Allow one INITIATED payment per booking. To retry or switch method: verify the old reference with Paystack, confirm and stop if it succeeded, otherwise mark it ABANDONED, then create and initialize the new payment. A retry never extends the hold (BR-044). Reason: the customer may have paid on the old reference.
12. A booking has at most one SUCCEEDED payment. A second success is stored as DUPLICATE_SUCCESS and listed for the manager (BR-016). Reason: money that cannot be matched must be visible, not lost.
13. An amount, currency or reference mismatch does not confirm. Record it, raise an attention flag and list it for the manager (FR-019). Reason: a wrong amount must never buy a place.
14. Reconciliation checks payments that are INITIATED and older than 2 minutes, and payments that are ABANDONED or FAILED and created in the last 48 hours. It applies the same checks as the webhook. A Paystack failure leaves records unchanged. Payments still unpaid after the booking is terminal become ABANDONED (FR-018). Reason: bank transfers can arrive after the customer leaves the page. The schedule is in `background-jobs-and-email.md`.
15. Never call any Paystack refund, void or reversal endpoint (BR-019). Reason: no screen, API or job may return money in Version One.
16. Build and test bank transfer with signed fake webhooks. Do not assume how test mode behaves (OQ-18). Reason: its real behaviour is not confirmed.
17. Set the payment routes' maximum duration to 15 seconds. Reason: it keeps them inside the plan limit (OQ-23).