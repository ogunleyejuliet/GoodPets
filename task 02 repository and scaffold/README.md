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
- Node.js and npm
- Access to a PostgreSQL database
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

### Configure environment variables

Create a local `.env` file in the project root. Add the environment-variable names required by the application and supply your own valid credentials locally. See Section 5.

Never commit `.env` or real credentials.

### Generate Prisma Client

```cmd
npx prisma generate
```

### Apply database migrations

Ensure the configured database is the intended development database before running:

```cmd
npx prisma migrate deploy
```

### Start the development server

```cmd
npm run dev
```

Open the address printed by Next.js, normally:

`http://localhost:3000`

The registration form is available through the existing booking flow at `/book`.

**Fresh-clone note:** These commands must be tested from a clean clone. If the repository's current environment setup, migration history, or database prerequisites require additional steps, update this section after the README test.

## 5. Environment Variables

The application uses environment variables for database connectivity. Variable names are documented here; values must remain private.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Connection string used by Prisma to connect to PostgreSQL. |
| `DIRECT_URL` | Direct/session connection used for database operations and migration configuration, as defined by the Prisma setup. |

Use connection strings from your own development database configuration. Never place actual credentials in this README, source code, screenshots, or committed evidence.

## 6. What This Deliberately Does Not Do

This Task 2 implementation focuses on scaffolding, repository practices, information design, and proving that customer registration persists to a real database.

It does not claim to deliver a complete production pet-care platform. Features outside the verified Task 2 scope—including a complete authentication and session lifecycle, production deployment, and full operational booking workflows—must be implemented and tested as their respective requirements are addressed.

## 7. Known Defects

The following items require verification before this README is considered final:

- **Fresh-clone setup:** The documented setup commands have not yet been independently verified by a person unfamiliar with the project. See `docs/readme-test.md`.
- **Full authentication lifecycle:** Database-backed registration does not, by itself, prove that login, session management, logout, and account recovery work end to end.
- **Production readiness:** Successful local database writes and a local failure test do not establish that the application is ready for production.

Replace or expand these entries with actual, reproducible defects and their exact file references. Do not leave resolved issues listed as current defects, and do not claim that an untested feature works.

## Task 2 Evidence and Documentation

- `evidence/11-write-succeeded-logs.txt` — successful registration requests.
- `evidence/12-database-rows.png` — database records.
- `evidence/13-write-failed-logs.txt` — failed registration request.
- `docs/false-success.md` — analysis of false-success risk.
- `docs/readme-test.md` — independent README usability test.
- `docs/working-tree.md` — working-tree and branch explanation.
- `docs/performance-note.md` — first-load performance observations.
