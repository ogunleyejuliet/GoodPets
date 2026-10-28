---
trigger: always_on
---

description: How to scope, ask, report and hand over work. Applies to every change.
---

# Change control

Job: keep every change small, in scope and reviewable.

1. Work on one requirement at a time and name its ID. If it is too big, stop at a natural step, say what remains and wait. Reason: small changes can be reviewed and reverted.
2. Build only what traces to a requirement. If it does not, stop and ask. Reason: extra features add risk and break scope.
3. If the spec gives a default, use it and list it under Assumptions. If the spec is silent, stop and ask. Reason: silent guesses become hidden decisions.
4. Ask before adding, removing or upgrading a package. Packages for the agreed stack are pre-approved. Reason: every dependency is a long-term cost and a supply chain risk.
5. Ask before creating an environment variable, a new folder layout or a new rules file. Reason: the owner controls the shape of the project.
6. Do not run commands that read or change live data, such as migrations, seeds and database queries. Write the code and hand the command to the owner. Reason: the owner controls the data.
7. Do not edit unrelated code. Report problems you notice instead. Reason: unrelated edits hide the real change in the review.
8. Do not edit AGENTS.md or any rules file unless asked. Reason: they are the owner's controls on you.
9. Say plainly what you did not do and what you could not check. Reason: a false "done" costs more than an honest "partly done".
10. End every response with a section titled Assumptions. Write "none" if there are none. Reason: it lets the owner review your decisions in one place.