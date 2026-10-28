---
name: add-protected-endpoint
description: Use when adding a route handler or server action that reads or changes data for a customer, staff member or manager, such as check-in, move booking or add authorization.
---

# Add a protected endpoint

This skill builds one endpoint, its schema, its registrations and its access tests.
For booking or payment scenario tests, use `payment-scenario-test` instead.

## Before you start

1. Check that these exist: the auth helper `requireUser`, the route-inventory test, the handler template, the schema template, and the wrong-role and two-customer test templates.
   Done when you have listed each one with its file path.
   If any is missing, stop and tell the owner. Do not improvise a replacement.

## Procedure

1. Identify the requirement.
   Open the requirement in PRD section 7 and its row in the permission matrix (PRD 11.7).
   Write down the endpoint name, the method, the allowed roles, whether it is public, and whether the data is owner-scoped.
   Done when all five items appear in your response.

2. Open the rules files for the area.
   Always open `auth-and-permissions.md` and `security.md`.
   Also open `pickup-and-checkout.md` for check-in or check-out, `booking-and-capacity.md` for booking changes, and `payments-paystack.md` for payment routes.
   Done when you have listed the files you opened.

3. Find the rate-limit row.
   Search BR-039 for a row that covers this endpoint.
   Done when you have written the row or written "no row".
   If the endpoint is public or abuse-prone and no row exists, stop and ask the owner.

4. Write the input schema.
   Copy the schema template and add every field the requirement names.
   Done when the file exists and each field in the requirement's behaviour text appears in it.

5. Write the handler.
   Copy the handler template.
   Fill in the schema parse, the auth helper call with the roles from step 1, the query and the response.
   Follow `auth-and-permissions.md` and `security.md` for what the handler must do.
   Done when the handler imports the shared helpers and contains no leftover template placeholder text.

6. Scope the query.
   If step 1 says the data is owner-scoped, pass the owner id from the session into the query.
   Done when no query in the handler reads an owner id, role or amount from the request.

7. Check the audit list.
   Open the event list in FR-036.
   If the action is listed, call the audit helper once in the handler.
   Done when the helper call is present, or you have written "not listed in FR-036".

8. Register the rate limit.
   If step 3 found a row, add the endpoint to the rate-limit configuration under that row's key.
   Done when the entry exists, or you have written "no row, nothing to register".

9. Register the route.
   Add the route to the route-inventory test list.
   Done when the route's path appears in that list.

10. Write the wrong-role tests.
    Copy the wrong-role template.
    Write one test for each role the permission matrix does not allow, plus one for a signed-out caller.
    Each test expects the rejection that `auth-and-permissions.md` gives for that case.
    Done when every disallowed role has a test.

11. Write the two-customer test.
    Skip this step if the data is not owner-scoped.
    Copy the two-customer template.
    Let customer A create the record. Let customer B request it. Expect the response that `auth-and-permissions.md` gives.
    Done when the test file exists, or you have written "not owner-scoped".

12. Hand over.
    List every new or changed file.
    State which tests need a database and that you did not run them.
    Follow `testing.md` for the handover wording.
    Done when the response lists the files and contains the words "not run" for each database test.