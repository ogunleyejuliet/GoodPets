# Good Pets — Task 2: Repository & Scaffold

## 1. What This Is

Good Pets is a pet-care booking application for dog and cat owners, built to let customers book pet services and register their details, with customer registration persisted in a PostgreSQL database.

## 2. Status

### Finished
- Next.js application scaffold and development server.
- Existing booking interface and customer registration form.
- Server-side customer registration API at `src/app/api/auth/signup/route.ts`.
- Server-side validation, Argon2id password hashing, duplicate-email handling, and PostgreSQL persistence through Prisma.
- Error handling for database connection failures.
- Successful database-write evidence for two distinct customer registrations.
- Deliberate database-failure test and recovery.
- Step 2 server-failure and recovery exercises, as documented in the evidence folder.

### Partially complete
- The wider booking experience is still under development and requires further end-to-end verification.
- Repository documentation and evidence are being completed and reviewed.

### Not yet verified or completed
- A fresh-clone setup test performed by someone unfamiliar with the project.
- Completion of all Task 2 Git branching, pull-request, and information-design requirements.
- Full production deployment and production-readiness checks.

This status describes the current Task 2 work, not a claim that the entire Good Pets product is production-ready.

## 3. Stack and Reasons

| Technology | Reason for choosing it |
|---|---|
| Next.js 14 | Provides the React application framework and server-side API routes in one project. |
| React 18 | Supports reusable, interactive user-interface components. |
| TypeScript | Helps catch type errors and makes application code easier to maintain. |
| Tailwind CSS | Supports consistent styling alongside the project's design-system rules. |
| PostgreSQL | Provides relational persistence for customer and booking data. |
| Supabase | Hosts the PostgreSQL database and provides database management tools. |
| Prisma ORM | Provides typed database access and schema/migration management. |
| Argon2id (`@node-rs/argon2`) | Hashes passwords before storage rather than storing plaintext passwords. |
| Antigravity | Used as the AI-assisted development environment for scaffolding and implementation. |

The stack combines a React-based application, typed server-side code, and relational database persistence without requiring a separate custom database-access layer.

## 4. Getting Started

### Prerequisites

- Git
- Node.js 18.17 or later (required by Next.js 14) and npm
- Access to a PostgreSQL database (the project uses Supabase)
- A terminal and code editor

### Clone the repository

```cmd
git clone https://github.com/ogunleyejuliet/GoodPets.git
cd GoodPets
```

### Install dependencies

```cmd
npm install
```

You may see deprecation warnings and a vulnerability report during install. Run `npm audit` to review the current report. See Section 7 for details of the known vulnerabilities.

### Configure environment variables

Copy `.env.example` to a local `.env.local` file in the project root and supply your own valid credentials:

```cmd
copy .env.example .env.local
```

Open `.env.local` and fill in each value. See Section 5 for the full variable list, purposes, and where to obtain each value.

**`DATABASE_URL` and `DIRECT_URL` must both be set before running migrations.** Never commit `.env.local` or real credentials — both are excluded by `.gitignore`.

### Generate Prisma Client

```cmd
npx prisma generate
```

### Apply database migrations

Ensure `.env.local` is configured and that the target database is your intended development database before running:

```cmd
npx prisma migrate deploy
```

### Start the development server

```cmd
npm run dev
```

Next.js prints the local URL when it starts. If port 3000 is already in use on your machine, Next.js automatically selects the next available port (for example 3001). Read the terminal output to find the actual address rather than assuming port 3000.

The registration form is available through the existing booking flow at `/book`.

**Fresh-clone note:** These commands must be tested from a clean clone. If the repository's current environment setup, migration history, or database prerequisites require additional steps, update this section after the README test.

## 5. Environment Variables

Variable names are documented here. Values must remain private and must never be committed. Copy `.env.example` to `.env.local` and supply your own credentials.

### Required for the current scaffold

These variables are needed to run migrations and for database-backed features (customer registration) to function.

| Variable | Purpose | Where to obtain |
|---|---|---|
| `DATABASE_URL` | Prisma runtime connection string. Used by the Prisma client for all application database queries. When using Supabase, this connects through the PgBouncer transaction-mode pooler (port 6543, with `?pgbouncer=true` appended). | Supabase project dashboard → Connect → Connection string → Transaction (pooler) |
| `DIRECT_URL` | Prisma migration connection string. Used by the Prisma CLI (`prisma migrate deploy`, `prisma db push`) only — not by the running application. When using Supabase, this connects through the session-mode pooler or direct connection (port 5432, without a pooler query parameter). Required because PgBouncer does not support the PostgreSQL protocol features needed for schema migrations. | Supabase project dashboard → Connect → Connection string → Session (pooler) or Direct connection |

Both URLs must be present in `.env.local` before running `npx prisma migrate deploy`. Without `DIRECT_URL`, the migrate command will fail with `P1012: Environment variable not found: DIRECT_URL`.

### Required for authentication (not yet implemented in Task 2)

| Variable | Purpose | Where to obtain |
|---|---|---|
| `AUTH_SECRET` | Signing secret for Auth.js JWT sessions. Required when Auth.js is wired; the application will refuse to start without it. | Generate with: `npx auth secret` or `openssl rand -base64 32` |

### Reserved for future integrations (not yet implemented)

These variables are listed in `.env.example` because they are defined in the project's technical specification. They are not needed for the Task 2 scaffold to start or register users. They are included so that the file is ready when each integration is built.

| Variable | Purpose | Where to obtain |
|---|---|---|
| `RESEND_API_KEY` | API key for the Resend email delivery service. | Resend dashboard → API Keys |
| `EMAIL_FROM` | Verified sender address used for all transactional email. | Resend verified domain or address |
| `PAYSTACK_SECRET_KEY` | Server-side secret key for Paystack payment processing (test mode). | Paystack dashboard → Settings → API Keys |
| `PAYSTACK_PUBLIC_KEY` | Client-side public key for Paystack (test mode). | Paystack dashboard → Settings → API Keys |
| `OPENAI_API_KEY` | API key for OpenAI (used by the AI assistant feature). | OpenAI platform → API keys |
| `OPENAI_CHAT_MODEL` | Identifier of the OpenAI chat model to use (for example `gpt-4o`). | Decided by the project owner (open question OQ-19 in the PRD). |
| `OPENAI_EMBEDDING_MODEL` | Identifier of the OpenAI embedding model to use for RAG retrieval. | OpenAI documentation |
| `INNGEST_EVENT_KEY` | Inngest event ingestion key for background job triggering. | Inngest dashboard → App → Event key |
| `INNGEST_SIGNING_KEY` | Inngest signing key for webhook verification. | Inngest dashboard → App → Signing key |
| `SENTRY_DSN` | Sentry data source name for error reporting. | Sentry project → Settings → DSN |
| `SUPPORT_INBOX_EMAIL` | Email address used to route support tickets. | Project-defined address |
| `EMAIL_ALLOWLIST` | Comma-separated list of addresses that may receive email outside production. Prevents sending real email to real users in development or staging. | Developer-chosen test addresses |
| `SEED_MANAGER_EMAIL` | Email address for the seeded manager staff account. Required only when running the seed script. | Developer-chosen test value |
| `SEED_FRONTDESK_EMAIL` | Email address for the seeded front desk staff account. Required only when running the seed script. | Developer-chosen test value |

Never place actual credentials in this README, source code, screenshots, or committed evidence.

## 6. What This Deliberately Does Not Do

This Task 2 implementation focuses on scaffolding, repository practices, information design, and proving that customer registration persists to a real database.

It does not claim to deliver a complete production pet-care platform. Features outside the verified Task 2 scope—including a complete authentication and session lifecycle, production deployment, and full operational booking workflows—must be implemented and tested as their respective requirements are addressed.

## 7. Known Defects

### Dependency vulnerabilities (npm audit — 30 October 2026)

`npm audit` reports 5 vulnerabilities in the installed dependencies: 4 high severity and 1 critical.

- **`glob` (high):** Versions 10.2.0–10.4.5 are vulnerable to command injection via `-c/--cmd` (GHSA-5j98-mcp5-4vw2). `glob` is a transitive dependency of `eslint-config-next`.
- **`next` (critical and high):** Next.js 14.2.35 is affected by multiple advisories including DoS via Image Optimizer, HTTP request smuggling, cache poisoning, cross-site scripting, and server-side request forgery. The full advisory list is in `evidence/21 npm audit.txt`. Upstream fixes require upgrading to Next.js 15+, which is a breaking change for this project.
- **`postcss` (high):** The version bundled with Next.js 14 is affected by XSS and path traversal issues in source-map handling (GHSA-qx2v-qp2m-jg93 and others).

These are unresolved at this stage. Upgrading Next.js is a project decision, not a Task 2 documentation fix.

### Fresh-clone setup

The documented setup commands have been partially verified by an independent README usability audit. The following items remain unverified because they require database credentials:

- `npx prisma migrate deploy` — confirmed to fail with `P1012: DIRECT_URL not found` when `.env.local` is absent. This is addressed by the updated Section 4 and Section 5 instructions.
- Customer registration form submission — requires a live database connection.
- Production build (`npm run build`) — not tested.

See the audit report in `docs/readme-test.md`.

### Full authentication lifecycle

Database-backed registration does not, by itself, prove that login, session management, logout, and account recovery work end to end.

### Production readiness

Successful local database writes and a local failure test do not establish that the application is ready for production.

## Task 2 Evidence and Documentation

- `evidence/11 write succeeded logs.txt` — successful registration requests.
- `evidence/12 database rows.png` — database records.
- `evidence/13 write failed logs.txt` — failed registration request.
- `evidence/21 npm audit.txt` — full `npm audit` output (30 October 2026).
- `docs/false success.md` — analysis of false-success risk.
- `docs/readme-test.md` — independent README usability test.
- `docs/working tree.md` — working-tree and branch explanation.
- `docs/perfomance note.md` — first-load performance observations.
