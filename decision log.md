# Good Pets — Decision Log 

## Task 1 — Design System

### Design-system source of truth
- The exported design-token JSON is the source of truth for design values.
- Token generation is performed with `npm run build:tokens`.
- The generator writes `design-tokens.css`.
- UI components should consume semantic design tokens rather than hardcoded colour values.
- Primitive palette values and semantic colour roles are kept distinct: primitives define the palette; semantic roles describe how the UI uses those values.
- Existing Task 1 design-system files should not be edited merely to make later tasks easier.

### Colour decisions
- Primary: `#037171`
- Secondary: `#F18F01`
- Tertiary: `#8BD7D2`
- Additional semantic roles were defined for neutral, neutral-variant, error, warning, and success states.
- The interface should reference semantic roles, not introduce raw hex values directly into components.

### Typography decisions
- The project uses the supplied typography system rather than arbitrary component-level font sizes and weights.
- The label-medium token was changed from weight `500` to `600` in the token JSON; the JSON remains the source of truth.
- Recorded letter-spacing divergences from the earlier type-scale baseline:
  - Display Large: `-3px`
  - Headline Large: `-1px`
  - Title Large: `-0.5px`
  - Label Large: `0px`
- Nunito was later added as a locally hosted font under `public/fonts` to avoid relying on a network request to Google Fonts. The implementation must continue to use the established typography tokens/classes.

### Token build and regression work
- Token conversion is run using `npm run build:tokens`.
- The token generator is expected to write only the generated token CSS file, not unrelated application files.
- A design-system regression branch was used: `test/design-system-regression`.
- A deliberate semantic-token defect was introduced for regression testing by changing `color.roles.color.light.primary` to a raw value (`#037171ff`). The defect was intended as a test and should not be mistaken for the desired production approach.
- Evidence mentioned during the work:
  - `evidence/07-raw-value-search.txt`
  - `evidence/08-agent-typography-answer.txt`

## Task 2 — Repository and Scaffold

### Project context and architecture
- The project is Good Pets, a fictional pet-care business/product used for the assignment.
- The existing repository and its context files are the source of truth; the task should extend the existing application rather than scaffold a replacement.
- The public landing page is at `/`.
- The booking page is at `/book`.
- The landing-page implementation includes `src/app/page.tsx` and `src/app/LandingContent.tsx`.
- The project uses the existing Next.js App Router structure.

### Documentation and repository decisions
- Project instructions and agent context are kept in repository documentation/context files, including `AGENTS.md` and the applicable rules.
- The README should explain what the project is, its current status, setup requirements, environment variables, and how to verify that the app has started.
- A README usability test should use an actual person unfamiliar with the project; observations and retest results must be recorded rather than fabricated.
- The working-tree documentation explains the relationship between the local working copy, Git history/GitHub, and production, and why branches and pull requests are useful.

### Information-design and interface decisions
- The Good Pets interface should use Task 1 tokens and typography.
- Marketing content should accurately describe the services actually represented by the product.
- The landing-page hero heading should have intentional maximum width and responsive sizing.
- Buttons should use rem-based padding and the Task 1 button-label typography.
- Clickable controls should provide appropriate pointer and hover feedback while preserving keyboard focus and disabled states.
- The Good Pets logo should navigate to `/`.
- Any content removed or consolidated should be documented with the reason; content should not be removed merely to satisfy a checklist.

### Font-loading decision
- Nunito was placed in `public/fonts` and should be loaded locally through the supported Next.js font setup.
- This was chosen to avoid unreliable external font fetching.
- The local font setup should preserve the established type scale and semantic typography classes rather than replace them.

## Task 3 — Client Validation and Authentication

### Authentication structure
- The authentication experience was consolidated around `/auth`, with modes for login, signup, and password reset.
- The signup API route identified during testing is:
  - `src/app/api/auth/signup/route.ts`
  - `POST /api/auth/signup`
- The signup handler uses server-side validation, Argon2id password hashing, Prisma persistence, and a server-side session cookie.
- Successful signup creates a real user record in the configured PostgreSQL database. Therefore, direct API tests must use an isolated development/test database.

### Validation decisions and observed behavior
- Client-side validation improves the user experience but is not a security boundary; the server must validate submitted values independently.
- The supplied signup handler checks:
  - Name is a string with trimmed length between 2 and 100 characters.
  - Email matches the server's email-format regular expression.
  - Password is a string with a minimum length of 8.
  - Password and confirmation match.
- **Important finding:** the shown password check uses `password.length < 8` and does not trim or reject an all-whitespace password. An eight-space password therefore satisfies that length check.
- The direct request using a one-character name returned:
  - HTTP `400`
  - `{"success":false,"error":"Full name must be between 2 and 100 characters."}`
- The direct request using `name = "Test Customer"` and an eight-space password returned:
  - HTTP `201`
  - A successful response containing a newly created customer record.
- This demonstrates that the backend accepted the whitespace-only password in that test. It is a validation defect to document, not a desirable product decision.
- The successful test created a real test user in the database connected at the time. The test email shown in the terminal output was `direct-test-20261101222311@example.com`.

### Database isolation and restoration
- A separate Supabase project was connected temporarily for direct signup testing so that test writes would not affect the original database.
- The project was configured with two connection variables:
  - `DATABASE_URL`: pooled runtime connection (transaction pooler, port `6543`).
  - `DIRECT_URL`: direct/session connection for Prisma migration operations (port `5432`).
- The temporary connection strings were restored to the original project in `.env` and `.env.local`.
- The safe inspection output showed both files pointing to the original host/region (`aws-0-eu-north-1`).
- `npx prisma migrate status` then reported:
  - 2 migrations found.
  - Database schema up to date.
  - Datasource host `aws-0-eu-north-1.pooler.supabase.com:5432`.
- A backup file `.env.original.bak` was created during the database switch. It is a local backup and should not be committed. Remove it only after confirming the original environment files are correct and the backup is no longer needed.
- The temporary test database and original database should be treated as separate environments. Do not run destructive commands against either database without checking the active connection target first.

### Authentication evidence and documentation
- The direct request command and its actual responses were saved in:
  - `task 03 client validation/evidence/16 direct request command and response.txt`
- The document explaining why client-side validation is not security was created at:
  - `task 03 client validation/docs/client side is not security.md`
- Evidence should distinguish observed results from assumptions and should not claim tests that were not run.

## Git and rollback decisions

### Testimonial change
- A testimonial section was added to the landing page in commit:
  - `e37158e` — `added testimonial to landing page`
- The change affected:
  - `src/app/LandingContent.tsx`
- The change was intentionally rolled back because the testimonial section was not wanted on the landing page.
- The rollback was performed with a Git revert, creating:
  - `0eda991` — `Revert "added testimonial to landing page"`
- The revert did not erase the original commit from history; it added a new commit that reverses its changes.
- The subsequent CSS-related commit was:
  - `53b5d1d` — `fix: css issue`
- After the revert, the supplied terminal output showed the local `main` branch one commit ahead of `origin/main`. The revert had not yet been pushed at that point.

### Why the revert was chosen
- A revert was used instead of resetting or rewriting shared history.
- This preserves the original commit and records the rollback transparently in the project history.
- The testimonial removal was a deliberate product/content decision, not an accidental deletion.

## Known project and product decisions relevant to implementation

These are product decisions established during Good Pets planning and should be preserved unless the PRD is deliberately revised:

- Good Pets supports dog and cat care.
- The service categories are grooming, daycare, and boarding.
- Customers can browse public information and ask the approved-content AI assistant without creating an account; authentication is required when starting a booking.
- Customers pay in full at booking through Paystack, with prices in NGN and the applicable tax shown before payment.
- Customers cannot cancel for a refund; eligible bookings may be rescheduled to a future available date subject to the service-specific deadline.
- Each pet has its own profile and booking.
- The manager manages bookings, availability, prices, policies, and the approved AI knowledge base.
- Email delivery was changed from the earlier Gmail/Nodemailer discussion to Resend.
- The exact hosting provider, production database hosting/recovery arrangements, monitoring provider, and final authentication-provider decision were not confirmed in the available project discussion.




