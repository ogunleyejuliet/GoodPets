# Model & Tool Choices — Task 2: Repository & Scaffold

**Project:** Good Pets  
**Date:** 29 October 2026  
**Status:** Completed & Evidenced  
**Document Reference:** `task 02 repository and scaffold/docs/model choices.md`

---

## 1. Purpose

This document records the artificial intelligence models, coding environments, and development tools used during Task 2 (Repository & Scaffold, Information Design, and Runtime Verification) for the Good Pets project. It details the technical rationale for each tool choice, presents concrete comparative observations grounded in verified repository evidence, and analyzes one genuine tool/methodology decision that was reversed during development.

---

## 2. Development Jobs and Tools Used

To distinguish the underlying artificial intelligence models from the software applications and runtime environments in which they executed, the development work is categorized below by specific job, tool/environment, underlying model, and rationale.

| Development Job | Tool / Environment | Underlying Model / Engine | Reason for Choice |
|---|---|---|---|
| **Scaffold Brief Refinement & Prompt Engineering** | Web Conversational Interface (Browser) | Large Language Model (e.g., GPT-4o / Gemini Advanced) | The initial brief was open-ended and prone to scope creep. A conversational reasoning model was used to transform naive requirements into a disciplined, two-phase inspection-gated prompt (`docs/scaffold prompt.md`). |
| **Workspace Inspection, Planning & Scaffolding** | Google Antigravity IDE (Agentic IDE) | Gemini (Gemini Pro / 1.5 Pro) | Required an agentic coding environment capable of reading project rules (`AGENTS.md`, PRD `good-pets-prd-v2.md`), executing read-only inspection commands, generating copy-ready implementation plans (`evidence/01 agent plan.txt`), and generating Next.js 14 App Router scaffolding. |
| **Design System Token Integration** | Node.js Runtime + Antigravity Agent | Node.js v24.19.0 + Gemini | Executed token transformation (`task 01 design system/tokens/convert-tokens.js`), integrated CSS variables into `tailwind.config.ts`, and built the custom static color checker (`scripts/check-styles.js`). |
| **Information Design & Head Implementation (Step 10)** | Antigravity IDE | Gemini | Refactored the landing page into a Server Component (`src/app/page.tsx`) and Client Component (`src/app/LandingContent.tsx`), wired the brand favicon (`/images/favicon.svg`), consolidated pricing into service cards, and applied fluid typography (`clamp()`) and design tokens (`.type-label-large`). |
| **Runtime Defect Diagnosis & Process Triage** | Windows PowerShell + Antigravity Terminal | Node.js Process Manager + Gemini | Diagnosed unstyled HTML defects caused by stale process caching (PID 4160) after build cache invalidation; inspected port bindings (`netstat`), terminated stale listeners, and restored dev server stability. |
| **Headless Browser & Responsive Viewport Verification** | Headless Google Chrome (v156) via Chrome DevTools Protocol (CDP) | Native Node.js WebSocket + Chrome CDP Engine | Standard headless CLI captures failed on Windows due to font/image loading races. Programmatic CDP allowed setting explicit device metrics (360px, 768px, 1280px), awaiting image decode (`img.decode()`), evaluating computed CSS properties, and capturing authentic evidence (`16`–`20`). |
| **Version Control & Branch Isolation** | Git CLI + GitHub Platform | Git 2.47 / GitHub Pull Requests | Isolated development streams into dedicated feature branches (`feat/task-2-working-tree`, `feat/task-2-information-design`), verified reviews, and merged into `main` via Pull Requests (#1 and #2). |

---

## 3. Observed Differences Between Tools and Models

The development of Task 2 revealed concrete, observable differences in how different tools and models performed across code quality, instruction following, design-system adherence, and debugging accuracy.

### 3.1 Unassisted Conversational Prompts vs. Repository-Grounded Agentic Execution
- **Observed Behavior:**
  - When given the original naive prompt (*"Create the initial app scaffold and build a simple landing page with authentication pages for login and sign-out..."* as recorded in `docs/scaffold prompt.md`), conversational models typically generated full user tables, session cookies, database connection strings, and multi-page flows.
  - In contrast, the Antigravity agent operating under the structured prompt inspected `AGENTS.md` and the PRD first. It recognized that database models, authentication, and payments were strictly deferred to subsequent phases. It produced an implementation plan (`evidence/01 agent plan.txt`) that restricted the scaffold strictly to a single minimal home screen, avoiding premature architectural lock-in.
- **Evidence:** `task 02 repository and scaffold/docs/scaffold prompt.md` vs. `task 02 repository and scaffold/evidence/01 agent plan.txt`.

### 3.2 Static Syntax Evaluation vs. Runtime Browser Verification
- **Observed Behavior:**
  - Static analysis and code-generation models frequently declared that styling and assets were "complete" because `globals.css` was imported in `layout.tsx` and Tailwind utility classes existed in `LandingContent.tsx`.
  - In reality, live browser inspection revealed that the landing page was rendering as raw, unstyled HTML with default Times New Roman fonts and broken layouts. The cause was runtime cache invalidation: running `npm run build` had cleared development hashes in `.next/`, causing the active Next.js development server to return HTTP 404 for all CSS and JS chunks.
  - Only direct runtime testing via Chrome DevTools Protocol (probing actual HTTP response codes, `window.getComputedStyle`, and `document.images`) detected the defect and verified the subsequent fix.
- **Evidence:** `task 02 repository and scaffold/evidence/07 port conflict.txt`, `evidence/08 port conflict resolved.txt`, and runtime diagnostic logs.

### 3.3 Generic Utility Styling vs. Design-Token Strictness
- **Observed Behavior:**
  - Standard AI models routinely rely on default utility shortcuts such as `font-bold text-sm`, `px-6 py-2.5`, `rounded-2xl`, or invalid syntax like `active:scale-98`.
  - When constrained by the Task 1 design system and verified by `scripts/check-styles.js`, the agent mapped all action button typography to `.type-label-large` (evaluating in browser to font-size `14px`, font-weight `500`, line-height `19.6px`, letter-spacing `0.1px`) and rem-based padding (`px-[1.5rem] py-[0.75rem]`).
- **Evidence:** `task 01 design system/tokens/design-tokens.css`, `scripts/check-styles.js`, and `task 02 repository and scaffold/docs/information design.md` (Section 6).

---

## 4. One Wrong Choice That Was Reversed

### The Task
Generating evidence screenshots for responsive viewports across Mobile (360px), Tablet (768px), and Desktop (1280px) for `evidence/20-responsive-three-widths.png`, as well as heading-wrap evidence for `18-heading-wrap-bad.png` and `19-heading-wrap-good.png`.

### The Initial Choice: Static Iframe Composite and Direct CLI Capture
Initially, evidence generation relied on:
1. Direct command-line screenshotting via Chrome CLI flags (`chrome.exe --headless=new --screenshot=...`).
2. Constructing a local HTML file (`.responsive-composite.html`) that embedded the running site via `<iframe>` elements (`<iframe src="http://localhost:3000" width="360" height="720">` and `<iframe ... width="768">`).

### Why the Initial Choice Was Unsuitable
1. **CLI Limitations on Windows:** Direct Chrome CLI execution failed to respect output destination paths consistently and provided no mechanism to wait for Next.js image optimization or web fonts to complete loading before capturing the screenshot.
2. **Iframe Rendering Races & Incomplete Evidence:** The iframe composite approach suffered from asynchronous loading races: iframes rendered before stylesheets and background images were fully decoded. Furthermore, the script completely omitted the required 1280px Desktop view (embedding only 360px and 768px).
3. **Stale Asset Caching:** When executed while the dev server was returning 404s for assets, the iframes rendered raw unstyled HTML with broken images, which were captured as outdated evidence files.

### The Alternative Chosen: Programmatic Chrome DevTools Protocol (CDP) Automation
The initial approach was reversed in favor of a custom Node.js automation script connecting directly to Chrome's remote debugging port (`http://127.0.0.1:9222`) over native WebSockets using the Chrome DevTools Protocol:
1. **Explicit Viewport Emulation:** Called `Emulation.setDeviceMetricsOverride` individually for each viewport (Mobile: 360×740, Tablet: 768×740, Desktop: 1280×740).
2. **Deterministic Asset Verification:** Executed in-page evaluations awaiting `img.complete && img.naturalWidth > 0` and calling `img.decode()` to guarantee that all imagery (e.g. `/images/hero-grooming.jpg` and `/images/logo.svg`) was fully rendered.
3. **Computed Style Validation:** Programmatically confirmed `window.getComputedStyle(h1).fontSize` at each breakpoint (36px at 360px width, 50.56px at 768px width, and 57px at 1280px width) and verified zero horizontal overflow (`scrollWidth <= clientWidth`).
4. **Authentic Full-Fidelity Compositing:** Captured base64 PNG buffers of the verified live views and composed them into an evidence layout containing all three viewports.

### What Improved
- Replaced stale, unstyled screenshots with high-fidelity evidence demonstrating the actual styled application.
- Fully proved responsive layout, fluid `clamp()` typography, and image loading across all three required widths without rendering artifacts or omitted viewports.

**Supporting Evidence:**
- Initial flawed script: Transcript step 334 (`scripts/generate-evidence.js`).
- Revised CDP script: `scripts/generate-responsive-evidence.js` and `scripts/recapture-evidence.js`.
- Verified outputs: `task 02 repository and scaffold/evidence/16-head-route-one.png`, `18-heading-wrap-bad.png`, `19-heading-wrap-good.png`, and `20-responsive-three-widths.png`.

---

## 5. Lessons Learned

1. **Agentic Coding Requires Strict Safety Gates:** AI coding agents excel when guided by explicit negative constraints and verification gates. Unconstrained prompts invite architectural over-engineering; structured two-phase gates keep deliverables strictly aligned with project requirements.
2. **Never Trust Visual Assumptions Without Runtime Proof:** Clean TypeScript and valid Tailwind classes do not prove that styles are active in the browser. Runtime probing of network requests and computed CSS properties is essential for verifying frontend deliverables.
3. **Isolate Development and Production Lifecycles:** Running `next build` inside an environment with an active `next dev` server corrupts build hashes and asset manifests. Production builds must only be executed when dev servers are halted or in isolated build containers.
4. **Use Programmatic DevTools for Verification Evidence:** For visual and responsive evidence, automated browser instrumentation via CDP provides deterministic, reproducible results that static mockups or naive screenshot commands cannot achieve.

---

## 6. Evidence References

| Evidence File / Artifact | Location | Purpose & Verification Finding |
|---|---|---|
| `01 agent plan.txt` | `task 02 repository and scaffold/evidence/` | Phase 1 implementation plan and assumptions approved prior to scaffold execution. |
| `02 files created.txt` | `task 02 repository and scaffold/evidence/` | Verified inventory of files created during the initial scaffold. |
| `03 server start.txt` | `task 02 repository and scaffold/evidence/` | Next.js development server startup output (ready in 2.6s). |
| `04 first load.txt` | `task 02 repository and scaffold/evidence/` | Chrome DevTools network timing for first document load (224.65 ms). |
| `05 nested folder error.txt` & `06 nested folder fixed.txt` | `task 02 repository and scaffold/evidence/` | Reproduction and resolution of Node `MODULE_NOT_FOUND` working-directory error. |
| `07 port conflict.txt` & `08 port conflict resolved.txt` | `task 02 repository and scaffold/evidence/` | Reproduction of `EADDRINUSE: 3000` port collision and recovery via PID termination. |
| `09 404 error.png` & `10 404 resolved.txt` | `task 02 repository and scaffold/evidence/` | Verification of Next.js 404 error page and recovery to home route. |
| `11 write succeeded logs.txt` & `12 database rows.png` | `task 02 repository and scaffold/evidence/` | Verification of valid database writes via Prisma and PostgreSQL. |
| `13 write failed logs.txt` & `false success.md` | `task 02 repository and scaffold/evidence/` | Deliberate database connection failure proving no false success is shown to users. |
| `14 working tree drawing.jpg` & `working tree.md` | `task 02 repository and scaffold/evidence/` | Documentation and diagram of local git to GitHub and production workflow. |
| `15-git-log-graph.txt` | `task 02 repository and scaffold/evidence/` | Verifiable Git commit graph showing feature branches and pull request merges. |
| `16-head-route-one.png` & `17-head-route-two.png` | `task 02 repository and scaffold/evidence/` | Browser DevTools inspection proving dynamic route titles, SEO tags, and favicon wiring. |
| `18-heading-wrap-bad.png` & `19-heading-wrap-good.png` | `task 02 repository and scaffold/evidence/` | Before-and-after evidence demonstrating fix for unconstrained heading wrap. |
| `20-responsive-three-widths.png` | `task 02 repository and scaffold/evidence/` | Programmatic CDP composite proving fluid layout at 360px, 768px, and 1280px. |

---

## 7. Outstanding Information Requiring Confirmation

The technical facts, toolchains, commit records, and evidence files above are fully verified against the workspace and Git history. The following external context items cannot be derived solely from repository files and should be confirmed by the developer:

1. **Specific Commercial Model Version Used for Scaffold Prompt Drafting:**
   - *Verified Fact:* `task 02 repository and scaffold/docs/scaffold prompt.md` documents a transition from an "Initial prompt before AI" to a "Final prompt after AI".
   - *Confirmation Needed:* The specific commercial model and web interface used by the developer to refine that prompt (e.g., OpenAI ChatGPT Plus with GPT-4o, Anthropic Claude 3.5 Sonnet, or Google Gemini Advanced).
2. **Local Machine Hardware Environment:**
   - *Verified Fact:* Commands ran on Windows (OS version `10.0.26100`) using PowerShell and Node.js `v24.19.0`.
   - *Confirmation Needed:* Whether local CPU/GPU specifications need to be appended to `docs/perfomance note.md` if hardware-specific benchmarking is required by the course assessor.
