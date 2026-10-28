#### Initial prompt before AI



You are a professional developer working on the Good Pets project.



Create the initial app scaffold and build a simple landing page with authentication pages for login and sign-out.



The landing page should contain three sections:

\- Header

\- Hero

\- Footer



Context and Design System

\- Read all context files in the project folder before starting implementation. Treat these files as the source of truth for project requirements.

\- Read `color.md`, `type scale.md`, and `design system.md` before implementing the UI. These files define the design system and are the source of truth for UI decisions.

\- Use only UI elements and styling values supported by the design system and the provided design-token JSON.

\- Do not use hard-coded hexadecimal color values.

\- Apply colors using the semantic color roles defined in the design system.

#### 

#### Final prompt after AI



You are working in the existing Good Pets workspace. Your task is **project scaffolding and one minimal home screen only**. Do not build the full product.

Work in two phases. **Phase 1 is inspection and planning only. Phase 2 may begin only after I explicitly approve the plan.** Silence, ambiguity, or a request for clarification is not approval.

###### Rules that apply throughout

###### Source of truth

Use the existing project documentation as the authority: `AGENTS.md`, the PRD (`good-pets-prd-v2.md`), applicable rules files, project-specific skills, design-system files, and existing source/configuration files.

* Inspect the workspace before deciding what to do. Discover nested instruction files and rules that apply to proposed files.
* Read relevant context, rules, and design-system files fully before implementation. List exact paths inspected; distinguish files found from files actually read.
* Do not invent requirements or silently resolve conflicting instructions. If files conflict, cite the paths and relevant sections, explain the impact, and ask me to resolve it.
* If a required file is missing or cannot be read fully, say which file and why. Do not pretend it was inspected.
* Use official technical documentation only to verify the configuration or behaviour of an already-approved technology, not to override project requirements.

###### Design system

The existing design system is the authority for all visual decisions, including colors, semantic color roles, typography, font loading, spacing, sizing, radius, shadows, borders, breakpoints, motion, and layout.

* Preserve design-system files unchanged.
* Do not invent tokens, substitute arbitrary values, or rely on framework/component-library defaults that conflict with the design system.
* If a required token or visual decision is missing, identify the gap and ask me.
* Use semantic tokens and color roles as specified by the actual design-system documentation.

###### Phase 1 safety gate

During Phase 1, you may use read-only inspection commands, but you must not write code, create or modify files, install packages, change configuration, or run workspace-modifying setup commands. After presenting your plan, stop and wait for my explicit approval.

###### Phase 1 — Inspect, explain, and plan

###### 1\. Workspace and documentation inventory

Inspect the existing workspace, including as applicable:

* `AGENTS.md` and nested `AGENTS.md` files.
* `good-pets-prd-v2.md`.
* Global and project-specific rules files, including their glob patterns.
* Relevant project-specific skills and instructions.
* All design-system files, including tokens, semantic color roles, typography, and related specifications.
* Existing package manifests, lockfiles, source files, build configuration, test configuration, and other setup files relevant to scaffolding.

Report:

* Exact workspace-relative path of each relevant file found and whether you read it fully.
* Number and paths of rules files; distinguish global rules from Good Pets-specific rules.
* Missing or unreadable expected files.
* Applicable glob patterns that do not match the existing or proposed layout.
* The current stack and what is already configured. Do not assume the project is empty or replace an existing setup without approval.

###### 2\. Summarize what you learned

Use inspected sources to summarize:

* Good Pets’ purpose and only the product requirements relevant to this scaffold.
* The documented technology stack and current project structure.
* Rules affecting initialization, file organization, code quality, testing, and scope.
* The design-token formats and groups, semantic color-role usage, typography/font loading, spacing, dimensions, radius, shadows, borders, breakpoints, viewport sizing, and motion where specified.
* Any conflicts, missing files, missing tokens, or decisions the documents do not settle.

Do not guess. If a topic is not covered by the source files, say so.

###### 3\. Proposed implementation plan

Propose a minimal plan without changing anything.

###### Scope and folder structure

Show the proposed folder/file structure and explain the purpose of each addition. Identify what is required by existing project rules and what is merely proposed. Do not restructure unrelated files. Check the proposed structure against relevant rules-file glob patterns.

###### Stack and packages

Preserve the existing approved stack. List every package you propose to add, remove, or change, with its version (or explain why a version cannot yet be established), purpose, and production/development classification. Explain why each is necessary. Do not assume Tailwind CSS, shadcn/ui, Vitest, Playwright, or any other tool is approved unless inspected project documents or existing setup support it. If a tool is optional rather than required, label it optional and ask before adding it.

###### Design-token integration

Explain how existing tokens will be consumed by the actual stack. If Tailwind CSS or shadcn/ui is already approved or proposed, explain how their defaults will be prevented from introducing competing or unauthorized visual values. Do not assume a Tailwind version, configuration format, component-library setup, or token architecture before inspection. Do not edit design-system files.

###### Hard-coded styling prevention

Propose a proportionate way to check for unauthorized hard-coded visual values, based on the actual stack and rules. Explain the files/patterns covered, token-file exclusions, handling of CSS declarations, inline styles and utility classes where relevant, false-positive risks, and known limitations. Do not claim complete coverage if the check is partial. Ask for approval before adding a new checker or dependency unless project rules already require it.

###### Minimal home screen

Propose a home screen containing only:

* The product name specified by project documentation.
* One short line taken from PRD section 1, if available and accessible.
* No invented buttons, links, navigation, cards, illustrations, or extra product features.

The screen is scaffolding only, not implementation of the full product. Identify the viewport-height approach supported by the design system and project requirements. If documentation does not decide the matter, ask whether to use `100vh`, `100dvh`, or another documented approach. Explain relevant browser-testing limitations without promising identical physical-device behaviour.

###### Verification

Propose the checks justified by the actual stack and project rules. At minimum, identify how you will verify that the app starts and builds, and how you will check the minimal screen for unintended horizontal/vertical overflow at 360, 768, and 1280 CSS-pixel viewport widths if approved tooling supports it. List extra lint, typecheck, unit-test, or end-to-end tooling only when required or approved. Distinguish planned checks from checks that can actually be run in this environment.

###### Environment variables and out-of-scope work

Inspect PRD section 10 before proposing `.env.example`. Include only variable names actually defined there; do not invent variables. If section 10 is unavailable or does not define the needed information, flag that and ask me before creating the file.

This scaffold must not add or configure a database, authentication, payments, Prisma, Sentry, Auth.js, CI, deployment, or other product features unless I explicitly approve a scope change. If project documentation identifies these as future work, list relevant requirement IDs only when they actually exist; never invent IDs. Ask whether a GitHub Actions workflow is in scope if relevant, but do not implement it without approval.

###### 4\. Plan and assumptions: save-before-approval requirement

End Phase 1 with a copy-ready section titled **Implementation plan and assumptions — save before approval**. It must include:

* Proposed implementation steps in order.
* Proposed files to create or modify.
* Packages and versions proposed.
* All assumptions, clearly separated from confirmed requirements.
* Unresolved conflicts and questions.
* Planned verification steps and known limitations.

If you state there are no assumptions, explain what you checked to reach that conclusion.

**Do not create this evidence file during Phase 1.** I will copy the plan and assumptions into `task-02-repository-and-scaffold/evidence/01-agent-plan.txt` before approving implementation. Do not begin Phase 2 until I have confirmed that I saved the plan, answered blocking questions, and explicitly approved the plan.

Finish Phase 1 by listing the decisions you need from me and asking for explicit approval. Then stop.

###### Phase 2 — Implement only the approved scaffold

Begin only after I have resolved blocking questions, saved the plan as `evidence/01-agent-plan.txt`, and explicitly approved the plan. If approval is conditional, implement only the approved items.

1. Make only the changes approved in Phase 1. Preserve the existing stack, repository, design-system files, `AGENTS.md`, and rules files.
2. Create only the agreed setup/configuration files and minimal home screen. Do not overwrite or reorganize unrelated files.
3. Use only approved packages and versions. Do not add optional tools or features without approval.
4. Use existing design tokens for all visual styling. Do not invent visual values or tokens. If an essential token or requirement is missing, stop the affected work and ask me.
5. Create `.env.example` only if approved and supported by PRD section 10; include only documented variable names and no secret values.
6. Run approved verification commands that are feasible in the environment. Do not claim a command, build, test, or check passed unless you actually ran it and observed success. If it was not run, say so and explain why.
7. Do not configure or connect a database, add authentication or payments, implement product features, deploy, set up CI, or commit changes unless I explicitly approve a scope change.
8. If a new conflict or missing requirement appears, stop the affected work and ask rather than inventing a workaround.

###### End-of-Phase-2 report

Provide a complete report containing:

1. **Files created:** every file path and its purpose.
2. **Files modified:** every existing file path and the reason. If none, state `Existing files modified: none.`
3. **Assumptions:** list every assumption; if none, state that explicitly and explain what you checked.
4. **Packages:** what was added, removed, or changed, with versions and reasons.
5. **Commands and results:** list relevant commands and actual outcomes for installation, start/build, lint, typecheck, tests, and any styling check. Mark each `PASS`, `FAIL`, or `NOT RUN`; explain failures and unrun checks.
6. **Design-system compliance:** how tokens are consumed, how relevant framework/component defaults were handled, styling-check coverage and limitations, and confirmation that design-system files were not modified.
7. **Rules compatibility:** identify applicable glob patterns that do not match the actual layout, or state that none were found.
8. **Out-of-scope confirmation:** identify future work left untouched and confirm no unapproved features were added.
9. **Run instructions:** exact install, start, build, and verification commands supported by the actual project configuration.
10. **Requirement audit:** use `PASS`, `FAIL`, or `NOT VERIFIED` for each applicable requirement, supported by evidence. At minimum cover: required files inspected; approval received before changes; approved stack and structure used; design-system and rules files unchanged; approved tokens used; only approved packages/features added; minimal home-screen content and overflow checks; commands/tests honestly reported; and all created/modified files and assumptions disclosed.

Do not mark anything `PASS` merely because you intended to do it. Do not claim full compliance while a required item is failed or unverified.

At the end, provide a copy-ready list of created files that I can save as `task-02-repository-and-scaffold/evidence/02-files-created.txt`. Do not claim that this evidence file exists unless you actually created it at the correct path.

###### Final instruction

This is a scaffold, not the full Good Pets product. The inspection-and-approval gate is mandatory, the design system remains authoritative, and the final report must distinguish verified results from assumptions and unverified work.



#### What changed and why

The revised prompt keeps the original two-phase approval gate, source-of-truth rules, design-system protection, minimal-home-screen scope, file inventory, and end-of-work audit. It makes the Task 2 evidence workflow explicit: the agent must provide a copy-ready implementation plan and assumptions, which you save as `evidence/01-agent-plan.txt` **before approving implementation**, and a copy-ready created-file inventory for `evidence/02-files-created.txt` after implementation. It also avoids assuming Tailwind, shadcn/ui, Vitest, Playwright, a styling checker, or extra packages are automatically required; the agent must justify them against the actual project documentation and seek approval before adding optional tooling. This keeps the scaffold focused while preserving honest verification and clear scope boundaries.



