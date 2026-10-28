---
trigger: model_decision
description: Use when adding or changing behaviour, writing or editing tests, or reporting that work is done.
---

description: Use when adding or changing behaviour, writing or editing tests, or reporting that work is done.
---

# Testing

Job: what a test must prove before work counts as done.

1. Ship tests with every behaviour change, in the same response. Reason: untested behaviour breaks silently.
2. Test the failure path as well as the success path. Reason: most bugs live in errors, retries and bad input.
3. Do not mock the thing under test. Mock only outside services you do not control. Reason: a test of a mock proves nothing.
4. Tests must not depend on order or shared state. Reason: random failures waste everyone's time.
5. Concurrency tests must send requests truly in parallel and assert the final state. Reason: sequential tests cannot find races.
6. For a bug, write a failing test first, then fix it. Reason: it proves the fix and stops the bug returning.
7. Never delete, skip or loosen a failing test to get a pass. Report it. Reason: that hides a real defect.
8. Name tests by behaviour, such as "rejects a second payment for the same booking". Reason: a failure then reads like a bug report.
9. Use fixed dates and times in tests. Do not read the real clock. Reason: date tests that read the clock fail at odd hours.
10. If the project says the owner runs database tests, write them and hand them over. State what was run and what was not. Never claim an unrun test passes. Reason: an unrun test is not evidence.