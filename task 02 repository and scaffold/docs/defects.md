

This document records defects encountered while scaffolding and testing the Good Pets application. It describes the observed symptoms, investigation, recovery, evidence, and current status.

A defect that was reproduced and recovered from is not necessarily a defect that remains in the current application. The status below distinguishes observed failures from unresolved issues. Evidence files are located in `task 02 repository and scaffold/evidence/`.

## Defect 1: Node.js Module Not Found When Running from the Wrong Directory

**Category:** Environment and working-directory error  
**Status:** Reproduced and resolved

### Observed behaviour

A Node.js command failed with a `MODULE_NOT_FOUND` error when it was executed from an incorrect or unexpected working directory. Node.js could not resolve the requested module or file from that location.

### Investigation and recovery

I checked the directory from which the command was executed and compared it with the expected project structure. I corrected the working directory and reran the command from the appropriate location.

### Evidence

- `evidence/05 nested folder error.txt` — records the original error.
- `evidence/06 nested folder fixed.txt` — records the recovery.

### Lesson

Commands depend on their working directory and the paths used by the project. Before changing code, confirm the current directory and the intended command location.

---

## Defect 2: Port 3000 Already in Use

**Category:** Local development environment  
**Status:** Reproduced and resolved

### Observed behaviour

The development server could not bind to port 3000 because another process was already using the port. The error included `EADDRINUSE`.

### Investigation and recovery

I inspected the processes listening on the relevant port using Windows networking diagnostics. After identifying the stale process, I stopped the appropriate process and restarted the development server. I then checked that the server could start successfully.

### Evidence

- `evidence/07 port conflict.txt` — records the port-conflict failure.
- `evidence/08 port conflict resolved.txt` — records the recovery.

### Lesson

A port conflict does not automatically mean the application code is broken. Check which process owns the port before terminating a process or changing application configuration.

---

## Defect 3: Home Route Returned a 404

**Category:** Routing  
**Status:** Reproduced and resolved

### Observed behaviour

A request to the affected route returned a 404 response rather than the expected page.

### Investigation and recovery

I inspected the requested route and the application's routing structure. I corrected the issue and retested the route to confirm that the expected page was accessible.

### Evidence

- `evidence/09 404 error.png` — captures the observed 404 state.
- `evidence/10 404 resolved.txt` — records the recovery.

### Lesson

A route should be verified through an actual request, not inferred from the existence of a component or source file. Testing the expected URL confirms whether the application serves the page.

---

## Defect 4: Landing Page Rendered Without Its Expected Styling

**Category:** Runtime assets and development-server state  
**Status:** Reproduced and recovered; verify current state before submission

### Observed behaviour

The landing page appeared as largely unstyled HTML, with default typography and a broken layout, even though the source files contained styling imports and utility classes.

Browser inspection showed that CSS and JavaScript chunks were returning HTTP 404 responses.

### Investigation and recovery

I investigated the running application through Chrome DevTools rather than assuming the CSS source was incorrect. The issue occurred after running `npm run build` while the Next.js development server was active. The development asset state had become inconsistent, and the active server was unable to serve the expected chunks.

I inspected the running processes and port bindings, addressed the stale development-server process, restarted the server, and verified the page in the browser.

### Evidence

- Browser runtime inspection and diagnostic logs captured during the investigation.
- `evidence/07 port conflict.txt` and `evidence/08 port conflict resolved.txt` document the related process and port investigation.
- `evidence/18 heading wrap bad.png` and `evidence/19 heading wrap good.png` show the before-and-after heading layout.
- `evidence/20 responsive three widths.png` records the responsive layout verification.

### Lesson

Source code that appears correct does not prove that the browser is receiving the correct assets. Runtime network responses and computed styles are necessary to verify the rendered application.

A production build should not be run in a way that disrupts an active development environment. Use separate build and development processes or environments when appropriate.

---

## Defect 5: Favicon Request Failed

**Category:** Static asset  
**Status:** Observed; verify current state

### Observed behaviour

During the first-load inspection, the browser requested `favicon.ico` and the request failed.

### Investigation and evidence

The failed request was observed in Chrome DevTools during the first-page-load test. The landing page itself returned HTTP 200, so the favicon failure was separate from the successful HTML document request.

The later information-design work included wiring the brand favicon at `/images/favicon.svg`. The existence of that change does not, by itself, prove that the browser's current favicon request succeeds.

### Evidence

- `evidence/04 first load.txt` — first-load measurements and observations.
- `evidence/16 head route one.png` and `evidence/17 head route two.png` — route and head-related verification evidence, where applicable.

### Required verification

Open the application in the browser, inspect the current favicon request in the Network panel, and confirm whether the configured asset returns successfully. Update this entry if the defect has been resolved.

### Lesson

A successful HTML response does not mean every asset loaded successfully. Check individual asset requests and verify the actual configured path.

---

## Database Failure Test: Signup Does Not Report False Success

**Category:** Database connectivity and error handling  
**Status:** Deliberate failure tested; no false-success behaviour observed

### Observed behaviour

I deliberately made the database unavailable by changing the hostname used by the application. When I submitted the signup form, the API returned HTTP 500, and the interface displayed an error rather than proceeding as though signup had succeeded.

The server logs showed that Prisma could not reach the database server. I also checked the database and confirmed that no record was created for the failed test account.

### Evidence

- `evidence/11 write succeeded logs.txt` — successful database-write logs.
- `evidence/12 database rows.png` — database-row evidence.
- `evidence/13 write failed logs.txt` — logs from the failed database connection.
- `docs/false success.md` — explanation of the test and findings.

### Conclusion

This test did not demonstrate a false-success defect. It demonstrated that the tested failure was surfaced to the user and that the failed signup did not create a database record.

The correct distinction is between a successful UI interaction, a successful HTTP response, and a confirmed database write. These are separate things and must be verified independently.

---

## Final Review

Before submission:

- [ ] Confirm the evidence files listed above exist and correspond to the actual tests.
- [ ] Confirm resolved defects no longer reproduce in the current environment.
- [ ] Update any status that has changed.
- [ ] Do not describe a recovered development failure as an unresolved production defect.
- [ ] Do not claim a test passed without the corresponding evidence.
- [ ] Keep this document consistent with the root README and the other Task 2 documents.
