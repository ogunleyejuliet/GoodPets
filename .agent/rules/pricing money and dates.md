---
trigger: model_decision
description: Use when calculating a price, showing money, counting days or nights, or handling dates and times
---

description: Use when calculating a price, showing money, counting days or nights, or handling dates and times.
---

# Pricing, money and dates

Job: how prices, totals and dates are calculated and stored. These mistakes cross every module.

1. Store money as integer kobo and show it as naira. Never use floating point. Reason: decimals drift and totals stop matching the amount sent to Paystack.
2. All money is NGN. Add no tax, fee or discount (BR-001). Reason: the PRD defines the price as the price.
3. Read prices from the price data. Never hard-code a price. Build every price key with the one shared key function. Reason: a price then changes in one place.
4. Recompute the total on the server for every booking: unit price times quantity (BR-004). The client total is for display only. Reason: the client can send any number.
5. Count quantity this way: grooming is 1, daycare is the days with both end dates counted, boarding is the nights from check-in to check-out. Reason: charging the wrong count is the most common pricing bug.
6. Work out a dog's size tier from the weight at booking: under 10 kg Small, 10 to 25 kg inclusive Medium, over 25 kg Large. Cats have no tiers. Do not add weight checks (BR-003). Reason: the PRD chose to trust the customer.
7. Save the unit price and total on the booking. Later price changes never alter an existing booking, reschedule or move, and no difference is collected or returned (BR-005). Reason: the customer agreed to the price they saw.
8. Use Africa/Lagos for every date and cut-off. Store service dates as plain dates and timestamps in UTC (BR-037). Reason: servers run in UTC and Lagos midnight is not UTC midnight.
9. Do date maths on plain dates. Do not build a service date from a local JavaScript Date object. Reason: the server's time zone silently shifts the day.
10. Work out today's Lagos date at request time, then count whole calendar days to the first service date. Test the cut-off just before and just after midnight Lagos. Reason: that is where off-by-one errors show.
11. Read opening hours, slot times and closing time from service settings. Reason: the manager can change them.