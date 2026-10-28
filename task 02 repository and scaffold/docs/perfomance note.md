\# Performance Note



\## 1. Purpose



This note records the initial page-load observation for the Good Pets scaffold during Task 2. The goal was to confirm that the application could start, respond to a browser request, and render its initial page.



\## 2. Test Environment



\- Date: 28 October 2026

\- Browser: Google Chrome 156

\- Local URL: `http://localhost:3000/`

\- Framework: Next.js 14.2.35

\- Server mode: Development

\- Start command: `npm run dev`

\- Observed viewport: 223 × 546 pixels



The viewport was mobile-sized in Chrome DevTools during the captured test.



\## 3. Server Startup Result



The development server printed:



```text

✓ Starting...

✓ Ready in 2.6s

```



The reported startup time was \*\*2.6 seconds\*\*. This measures the time reported by Next.js to become ready, not the browser's page-load duration.



\## 4. Browser Network Result



Chrome DevTools showed the following for the main document request:



| Measurement | Observed result |

|---|---|

| Request | `GET http://localhost:3000/` |

| HTTP status | `200 OK` |

| Content type | `text/html; charset=utf-8` |

| Total document request duration | 224.65 ms |

| Waiting for server response | 93.80 ms |

| Content download | 120.20 ms |



The successful HTTP response indicates that the server returned the page document to the browser.



The 224.65 ms measurement is the duration of the document request in the Network Timing panel. It should not be described as the total page-load time because it does not necessarily include all page resources and rendering activity.



\## 5. Visual Result



The browser displayed the Good Pets heading and the description of the app's intended purpose. The visible content described pet-care bookings and payments for grooming, daycare and boarding, an AI assistant, and front desk and manager operations.



This confirms that the initial scaffold page was visible in the browser during the test.



\## 6. Issues Observed



The Network panel showed a failed request for `favicon.ico`. This issue should be investigated and resolved if a favicon is required by the scaffold or assignment.



The test was performed at a mobile-sized viewport of 223 × 546 pixels. A separate desktop-sized viewport test is needed if desktop responsiveness or desktop first-load behavior must be evidenced.



\## 7. Interpretation and Limitations



The initial test demonstrates that:



\- The Next.js development server started successfully.

\- The main document request returned HTTP 200 OK.

\- The initial Good Pets page rendered visibly.

\- The main document request completed in 224.65 ms under the observed local development conditions.



This was a single local development observation. It does not establish typical performance, production performance, or performance under network latency or concurrent traffic. The request duration and server startup time measure different things and should be reported separately.



\## 8. Evidence



Related evidence files:



\- `evidence/03-server-start.txt` — development server startup output.

\- `evidence/04-first-load.txt` — browser request details and first-load observations.



Attach or retain the corresponding terminal and Chrome DevTools screenshots in the evidence folder if required by the assignment.



