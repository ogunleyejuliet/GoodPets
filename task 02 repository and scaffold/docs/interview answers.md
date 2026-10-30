1. What is the difference between Git Flow and trunk-based development, and why have a lot of teams moved toward trunk-based?
Git Flow uses several long-lived branches with defined roles, commonly main, develop, feature branches, and release or hotfix branches. It can suit products with scheduled releases and formal release management, but work may sit on branches for a long time. Integrating it later can create large conflicts and delay feedback.

Trunk-based development keeps integration frequent: developers commit to a shared trunk or use short-lived branches that merge into it quickly. In a team, this usually depends on automated tests, code review, small changes, and feature flags when unfinished work must not be exposed. Frequent integration makes conflicts smaller and reveals incompatibilities earlier, which supports continuous delivery.

Neither approach is automatically safer. Trunk-based development without tests or discipline can put unstable code on the trunk. Git Flow can be appropriate when releases need strict coordination. I would choose based on release needs, team size, deployment capability, and test coverage.

For this assignment, I used feature branches to isolate changes and brought accepted work back to main. I would use pull requests and appropriate checks consistently rather than keeping branches alive unnecessarily.
2. What does git push --force actually do, and why is --force-with-lease generally safer?
A normal push checks whether the remote branch can advance from its current commit to the commits I am pushing. git push --force bypasses that protection and can move the remote branch pointer even when that discards commits currently on the remote. It does not immediately erase every copy of those commits, but it can make them disappear from the branch history and disrupt collaborators.

git push --force-with-lease adds a check: it normally updates the remote only if the remote branch is still at the commit I expect. If someone else pushed new work since I last observed the branch, the lease fails rather than silently overwriting their work.

It is safer, not harmless. An incorrectly updated expectation or the wrong branch can still cause trouble.

I would avoid force-pushing shared branches. If rewriting my own unpublished feature branch is necessary, I would first inspect git status, the branch name, and the remote log, and make sure I understand which commits will be replaced. For shared work, coordinating and using a normal merge is usually safer.
3. Why is rewriting history, through rebase, amend or force push, dangerous on a shared branch?
Rebase and amend create new commits rather than preserving the original commit identities. A commit is identified by its content and parent history, so changing a commit or its parent produces a different hash. If other people have based work on the old commits, rewriting the shared branch leaves their local histories pointing to commits that no longer match the remote branch.

That can lead to duplicated commits, confusing merges, lost-looking work, or a force push that removes someone else's changes from the visible branch. The old commits may still be recoverable for a while, but recovery should not be the plan.

I distinguish local cleanup from shared history. Before pushing, amending a typo or rebasing my own feature branch can be reasonable. Once others may have pulled the branch, I prefer additive changes and a merge, and I coordinate before any necessary rewrite.

Before changing history, I inspect the graph and confirm the branch. For this repository, I can explain the actual feature branch and merge path using:
git log --oneline --graph --decorate --all


The graph is better evidence than relying on memory.
4. What is the difference between git merge and git rebase, and when would you actually pick one over the other?
git merge joins two histories by creating a merge commit when needed, preserving the fact that the branches developed separately. It is useful for integrating reviewed feature work and for shared branches because it does not rewrite the commits already published on either branch.

git rebase replays commits from one branch onto a new base. It can produce a more linear history, but the replayed commits have new hashes. That makes it useful for tidying my own local feature branch before review, provided I have not made it a shared dependency. I would not casually rebase a shared branch.

For this assignment, the information-design work used a feature branch and a pull-request workflow. The later booking-flow change was brought onto main, as shown by the actual Git history. I would describe the precise method used for each change from the log rather than say every change followed the same workflow.

My decision depends on whether preserving branch context matters, whether history is shared, and the team's conventions. Neither command replaces reviewing the diff, running tests, or checking the final branch.
5. What causes a merge conflict, and what is actually happening in the file when you see the conflict markers?
A merge conflict occurs when Git cannot automatically combine changes from two histories. For example, both branches might edit overlapping lines, or one branch might edit a file while the other deletes or renames it. Git can merge many changes automatically, but it cannot reliably infer the intended meaning when edits overlap.

In a conflicted text file, Git places markers such as <<<<<<<, =======, and >>>>>>> around competing versions. The section above the separator is generally the current branch's version; the section below it is the incoming version. The exact labels depend on the merge or rebase context.

These markers are temporary instructions for the person resolving the conflict, not valid application code to leave behind.

I would inspect the surrounding code and understand both changes, edit the file into the intended final version, remove all markers, and then run git diff --check, tests, and the application. I would stage the resolved file only after reviewing it.

Blindly choosing “ours” or “theirs” can discard valid work, so the correct resolution is semantic, not just textual.
6. What is the difference between the working directory, the staging area and the repository?
The working directory is the checked-out files I edit on my computer. Changes there are not automatically part of the next commit.

The staging area, or index, is the proposed snapshot for the next commit. git add selects changes for that snapshot; it is possible to stage only some changes in a file. The local repository stores commits and their history. A commit records the staged snapshot and points to its parent commit or commits.

The remote repository, such as GitHub, is a separate copy that is updated by pushing. Editing a file does not update the staging area; staging does not commit; committing locally does not automatically push to GitHub.

I use git status to see which files are modified, staged, untracked, or ahead of or behind the remote. Before committing, I inspect git diff for unstaged changes and git diff --cached for staged changes.

This matters in my Task 2 work because the model choices.md file was staged separately from the booking-flow commit. Checking the staged diff prevents unrelated or unintended changes from entering a commit.
7. What is branch protection, and what does it typically enforce?
Branch protection is a repository-hosting rule that prevents risky changes from being pushed directly to important branches, often main.

Depending on the platform and configuration, it can require pull requests, approvals, passing status checks, resolved review conversations, signed commits, or restrictions on who can push or delete the branch. It may also block force pushes.

The goal is to make the safe path the normal path: changes are reviewed, tests run, and the branch cannot be updated until required conditions are met. Protection is not a replacement for good code or tests, and its effectiveness depends on the rules actually enabled and whether administrators can bypass them.

For an individual learning repository, I would protect main when practical, use a feature branch, open a pull request, review the diff, and merge only after verification.

I should not claim this repository had branch protection enabled unless I can show its GitHub settings. If protection was not configured, I would say so and explain which rules I would add rather than imply the workflow enforced them automatically.
8. Walk me through a technical project you built end to end.
For this assessment, I worked on the Good Pets repository scaffold and then improved the booking service-selection flow. I began by reviewing the available project context and design-system files so the implementation would follow the existing semantic tokens rather than introduce unrelated styling values.

I treated the assignment as a sequence of inspectable steps: plan before implementation, scaffold a minimal interface, run it locally, capture errors and recovery, document decisions, and use Git to track changes.

For the later booking-flow experiment, I separated the service-selection step from the details for grooming, daycare, and boarding. The labels were made context-aware, and the buttons were aligned with the existing label typography and rem-based spacing. I tested the resulting interface and observed that the flow worked in my local environment. The change is visible in the repository's booking page and commit history.

I also worked on information design and responsive verification. I used browser inspection to investigate styling and layout rather than relying only on the source code. I captured evidence at mobile, tablet, and desktop widths and documented the choices made during the work.

I would walk through the project by showing the README instructions, actual run command, screenshots, Git graph, and relevant test or server evidence. I would also state what is incomplete. I would not describe a local scaffold as a fully deployed production service, or claim a database-backed booking is complete without verified persistence evidence.
9. Tell me about a time when something you built broke in production.
I have not had a verified customer-facing production incident to describe from this assignment, so I would not present a local development mistake as a production outage. However, I did encounter a real runtime failure while working on the Good Pets project.

After running npm run build while the Next.js development server was active, the landing page started rendering as unstyled HTML. The page structure was present, but the styling and layout were broken because the development server was returning HTTP 404 responses for CSS and JavaScript chunks. This showed me that code appearing correct in the files did not guarantee that the application was working correctly in the browser.

I investigated the problem using Chrome DevTools and terminal diagnostics rather than immediately changing the styling code. I checked the actual network responses and computed browser styles. I also inspected the process using port diagnostics and identified a stale process associated with the development server. After resolving the stale-process issue and restarting the development server cleanly, I verified the page again in the browser. I captured evidence of the failure and the recovery.

The lesson was to distinguish a source-code problem from a runtime or environment problem. If this had affected production users, I would first assess the impact, communicate the incident, and apply the safest rollback or mitigation. Then I would preserve logs, investigate the root cause, add a regression check, and document follow-up actions.

My example is a real development failure and recovery, not a claim that I have already handled a production outage.
10. How do you approach learning a new technical platform or codebase quickly when starting a new engagement?
I start by identifying the outcome, constraints, and risks before changing code. I read the README, project instructions, architecture and context files, package scripts, environment-variable examples, tests, and recent Git history.

I run the application using the documented command and record the baseline. Then I trace one important user journey through the UI, request handling, persistence layer, and logs rather than assuming the visible interface proves every layer works.

I make a small change with a clear acceptance criterion, inspect the diff, and verify the behavior. When I use an AI coding agent, I ask it to inspect first, explain assumptions, and wait for approval before broad changes. I compare its plan with the source-of-truth files and test its claims myself.

For a new engagement, I also identify what I do not know and ask focused questions instead of silently inventing requirements. I keep a decision log and capture reproducible evidence so another person can follow the reasoning.

In Task 2, this meant treating the design-system files as authoritative, limiting the scaffold scope, and using Git history and local testing to inspect the later booking-flow change.
11. What is the difference between code that is correct and code that is complete?
Correct code behaves as intended for the cases it handles. Complete software also covers the requirements, failure states, accessibility needs, operational concerns, documentation, and verification needed for the feature to be usable and maintainable.

A function can be logically correct in its happy path while the overall feature is incomplete because errors are swallowed, data is not persisted, users receive no useful feedback, or the setup instructions are missing.

For example, a form may validate its fields and display a success message, but if the server never confirms a database write, the user journey is not complete. Likewise, a page that looks good at one viewport may be incomplete if the heading overflows on mobile or controls cannot be used with a keyboard.

I assess completeness against explicit acceptance criteria and evidence: normal behavior, failure behavior, persistence, responsive layouts, accessible interaction, logs, and clear setup instructions. I also document known defects and out-of-scope features.

For this assignment, a polished booking screen alone does not prove the whole Good Pets service is production-ready; I need to state exactly which parts I built and verified.
12. How do you design software for a customer who will need to maintain it after you are gone?
I try to make the next person's job easier by using familiar structure, clear naming, explicit boundaries, and a single source of truth for important decisions. I avoid scattering values through components when a design token or configuration belongs in one place.

I keep setup steps reproducible, document environment-variable names without exposing secrets, and explain why key choices were made rather than only listing what I did.

I also make failure states observable. Useful logs, meaningful error responses, tests, and a short known-defects list help a maintainer understand what happened without guessing. I prefer small, reviewable commits and focused changes because they make regressions easier to locate and revert. I do not claim a feature works unless I have tested it, and I distinguish verified facts from assumptions.

In Good Pets, the design-system tokens and semantic roles are intended to keep styling consistent and prevent hardcoded values from spreading. The Task 2 documentation and Git history provide context for later contributors.

Before handover, I would ask someone unfamiliar with the project to follow the README, record where they get stuck, fix the instructions, and retest. Maintainability is demonstrated by another person being able to run, understand, and safely change the software—not by the original author understanding it.
13. Your first page load took a specific number of milliseconds. Where did that time go? Name the parts you can measure and the parts you are guessing about.
My captured Chrome DevTools measurement for http://localhost:3000/ was 224.65 ms for the document request, which returned HTTP 200. The test used Chrome 156, a 223 × 546 mobile-sized viewport, the Next.js 14.2.35 development server, and Disable cache. This is the duration of the HTML document request, not the complete page-load or time-to-interactive measurement.

The Timing tab reported 93.80 ms waiting for the server response and 120.20 ms downloading the content. It also showed 5.54 ms stalled, 1.79 ms for the initial connection, 0.12 ms for request sending, and 31 microseconds for DNS lookup. These listed values explain much of the request timing, although they should not be treated as a complete browser-rendering breakdown.

Separately, the Next.js server reported it was ready in 2.6 seconds; that is server startup time, not part of the 224.65 ms document request measurement.

I visually confirmed that the Good Pets heading and description appeared. I also observed a failed favicon.ico request. I did not measure all resource requests, JavaScript execution, layout, paint, or interaction readiness, so I cannot assign them exact durations.

These are local development results, not a production benchmark, and the viewport was mobile-sized.
14. Your application reported success to the user while writing nothing to the database. Explain the mechanism that allowed that, and name the one check that would have caught it in thirty seconds.
In my documented deliberate database-failure test, Good Pets did not report success while writing nothing. I changed the database hostname to make the database unavailable. The signup form displayed an error, the signup API returned HTTP 500, and the server logs recorded that Prisma could not reach the database server at the invalid hostname. This evidence demonstrates that the failure was surfaced to the user instead of being presented as a successful signup.

The mechanism that could allow false success in another implementation is an incorrect success state. For example, the client might advance before the write completes, or the server might catch a persistence error but still return a successful response. My evidence does not show that this mechanism occurred in Good Pets, so I should not claim that it did.

The one quick check that would catch a missing write is to submit a unique test account and immediately query the database for its row. I would also inspect the network response and server logs to locate the failure.

My evidence set compares the successful signup logs and database rows (evidence/11-write-succeeded-logs.txt and evidence/12-database-rows.png) with the failed request logs (evidence/13-write-failed-logs.txt). I also confirmed that no record was created for the failed signup test account.

The write-failed logs establish the connection failure; the database check confirms that the failed signup did not create a record.
15. Wrong-answer analysis: “I check the app by signing up a test user and confirming I reach the dashboard. If the dashboard loads, the backend is working.” What is wrong with this, what would it miss, and what would you do instead?
Reaching a dashboard proves only that one path led to that screen. It does not prove the account was correctly stored, that the database transaction committed, that the right user owns the returned data, or that later reads work.

The dashboard might be static, use mock data, rely on client-side state, or appear after a request that incorrectly reported success. It also misses error handling, duplicate submissions, authorization, validation, and persistence after refresh or a new session.

I would test the full request lifecycle. I would inspect the browser network request and status, check server logs, and verify the database contains the expected record with a real ID and timestamp. I would then reload or query the data independently to confirm it persists.

I would repeat with distinct values and test a controlled database failure to verify the UI does not claim success when the write fails. I would check that the server returns meaningful error statuses and that the client displays an accurate error state.

A test is strong when it verifies the outcome at the layer where that outcome matters. Navigation is a UI check; a confirmed database row is persistence evidence. Neither alone proves every aspect of the backend, so I combine tests, logs, and direct inspection.
Additional viva question: How would you handle accidentally committing sensitive information to a public repository?
I would treat the secret as compromised and act immediately. First, I would identify what was exposed and revoke or rotate it with the issuing service—for example, disable an API key and create a replacement. Deleting the line in a new commit is not enough because the value remains in Git history and may already have been copied or cached.

Next, I would remove the secret from the repository and, where warranted, rewrite history using an appropriate history-cleaning tool, coordinating with collaborators because rewriting published history affects everyone. I would force-push only with an agreed recovery plan and the correct safeguards.

I would inspect branches, tags, pull requests, logs, and other copies, then scan the repository again for similar exposures. I would move local values into environment variables or a secret manager, add secret files to .gitignore, and provide a safe .env.example with names and placeholders only.

Finally, I would document the incident and improve prevention through secret scanning, review checks, and least-privilege credentials. I would not claim the exposure is harmless just because the commit was reverted. Rotation is the urgent containment step; history cleanup and prevention follow.