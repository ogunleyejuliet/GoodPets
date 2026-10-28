---
name: payment-scenario-test
description: Use when writing a test for a booking or payment scenario that involves parallel requests, webhooks, hold expiry, retries or late payments.
---

# Write a payment scenario test

This skill builds one scenario test with its seed, its actors and its database assertions.
For endpoint access tests such as wrong role or another customer's record, use `add-protected-endpoint` instead.

## Procedure

1. Name the scenario.
   Find the acceptance item in the PRD. Look at the acceptance lines under FR-013 to FR-019 and FR-022, and at sections 17.3, 17.4 and 17.11.
   Write the scenario name, the PRD ID and the invariant in one sentence.
   Done when all three appear in your response.

2. Check the helpers.
   Look for each helper and write its file path:
   - Webhook signer: builds a payload from the whitelisted fields, serialises it once, signs those exact bytes with the test secret, and returns the body and the signature header.
   - Parallel runner: takes a list of async actions, waits at a barrier, starts them together and returns every result.
   - Invariant queries: one SQL file of named queries.
   - Paystack verify stub: replaces the Paystack client and returns a status, amount, currency and reference that you choose.
   - Clock: sets a fixed time for the test.
   Done when every helper has a path.
   If one is missing, write it first. Show the owner the helper before you use it.

3. Write the expected outcome.
   Open `booking-and-capacity.md` and `payments-paystack.md`.
   Read the parts that cover this scenario.
   Write the expected final state as a list of database facts: booking status, counter values, payment statuses, email log rows, audit events and webhook event rows.
   Done when the list is written before any test code.

4. List the actors.
   Name each actor and the helper that triggers it:
   - Parallel requests use the runner.
   - A webhook uses the signer.
   - Hold expiry uses a direct call to the expiry function with the clock set.
   - Reconciliation uses a direct call with the verify stub.
   - A return page check uses a direct call to the shared confirmation function.
   Done when every actor in the scenario has a named helper.
   Open `background-jobs-and-email.md` for the triggers of the jobs.

5. Seed the rows.
   Write a seed function that creates only the rows this scenario reads.
   Reuse an existing seed function when one fits.
   Done when the seed is a named function and the test starts from a clean database state.
   Use a real PostgreSQL with pgvector, as `database-and-migrations.md` says.

6. Write the actor calls.
   Put each actor in its own function so the runner can start it.
   Done when each actor from step 4 has one function.

7. Run the actors together.
   Start them with the runner.
   If the scenario is a race, wrap the whole run in a loop.
   Ask the owner for the loop count if the project has not set one.
   Done when the test starts all actors through the runner. For a race, the loop count is also a named constant.

8. Assert the final state.
   Run the invariant queries and check every fact from step 3.
   Read the facts from the database, not from the return values.
   Done when each fact in the step 3 list has an assertion that queries the database.

9. Assert the side effects.
   Count the email log rows, audit events and webhook event rows, and compare each count with the step 3 list.
   Done when each count has an assertion.

10. Hand over.
    Write the exact command that runs the test.
    List the database prerequisites, including the pgvector extension.
    State that you did not run the test.
    Follow `testing.md` for the handover wording.
    Done when the response contains the command, the prerequisites and the words "not run".