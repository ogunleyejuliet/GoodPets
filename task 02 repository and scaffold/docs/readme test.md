# README Setup Test

## Test Information

| Item | Details |
|---|---|
| Project | Good Pets |
| Date | 30 October 2026 |
| Tester | AI coding agent (assisted test) |
| Operating system | Windows 11 |
| Terminal | PowerShell |
| Node.js version | v24.19.0 |
| Test environment | Fresh local clone |
| Database credentials | Not available |

## Purpose

The purpose of this test was to evaluate whether a developer could follow the Task 2 README to obtain the project, install its dependencies, configure the environment, prepare the database and start the application.

An AI coding agent was used to perform this preliminary setup test. The test was conducted in a fresh local clone so that existing installed dependencies and local configuration would not affect the results.

This is an agent-assisted technical test, not a human usability test. A separate test with someone unfamiliar with the project is still required.

## Test Results

| Step | Test | Result | Observation |
|---|---|---|---|
| 1 | Obtain the project | Passed with limitation | A fresh local clone was created successfully. The GitHub remote was not independently used for this test. |
| 2 | Install dependencies | Passed with warnings | `npm install` completed and installed 401 packages. Deprecation warnings, blocked install scripts and reported vulnerabilities were observed. |
| 3 | Configure environment variables | Not completed | No database or service credentials were available. The audit identified missing environment-variable documentation, which was subsequently corrected. |
| 4 | Generate Prisma client | Passed | `npx prisma generate` completed successfully. |
| 5 | Apply database migrations | Failed | `npx prisma migrate deploy` returned Prisma error P1012 because `DIRECT_URL` was missing. |
| 6 | Start development server | Passed | `npm run dev` started successfully. Since port 3000 was occupied, Next.js selected port 3001. |
| 7 | Open application routes | Passed | The `/` and `/book` routes returned HTTP 200. Database-dependent functionality was not verified. |

## Issues Identified

### 1. Missing environment variable

The initial `.env.example` did not include `DIRECT_URL`, although the Prisma schema required it.

This meant that a developer following the original setup instructions could reach the migration step without providing a required variable.

**Correction made:** `DIRECT_URL` was added to `.env.example`, and the README was updated to explain the two database connection variables.

### 2. Incomplete environment-variable documentation

The original README documented only two environment variables, while the example environment file contained more.

**Correction made:** The README's environment-variable section was expanded to document all 17 variables and distinguish current scaffold requirements from variables intended for future integrations.

### 3. Environment-file naming inconsistency

The original README referred to `.env`, while `.env.example` instructed developers to use `.env.local`.

**Correction made:** The README setup instructions were updated to use `.env.local` consistently.

### 4. Database migration could not be completed

The migration command failed because `DIRECT_URL` was not available.

The cause was identified from the Prisma configuration. A successful migration using valid database credentials has not yet been demonstrated.

### 5. Dependency warnings

The dependency installation completed, but warnings were reported. A subsequent `npm audit` identified five vulnerabilities: four high and one critical.

The audit output was saved in:

`evidence/21 npm audit.txt`

The dependency findings should be reviewed before production deployment.

## Corrections Made After the Test

Following the test and review of its findings:

- Added `DIRECT_URL` to `.env.example`.
- Expanded the README environment-variable documentation.
- Standardised the environment-file instructions around `.env.local`.
- Clarified the database migration prerequisites.
- Specified Node.js 18.17 or later.
- Documented the development-server port fallback.
- Created a root-level README linking to the detailed Task 2 README.

These corrections improve the setup documentation, but they do not establish that every setup step now succeeds with a live database.

## Tests Still Outstanding

The following checks were not completed:

- Successful database migration with valid credentials.
- Customer registration and database persistence.
- Production build using `npm run build`.
- Verification of the `@node-rs/argon2` native installation in a clean environment.
- Testing of integrations that are not yet implemented.
- A separate README usability test with a person unfamiliar with the project.

## Conclusion

The agent-assisted test confirmed that the project could be installed, the Prisma client generated, the development server started and the main application routes accessed.

It also identified setup-documentation problems, particularly the missing `DIRECT_URL` variable and inconsistent environment-file instructions. These were corrected after the test.

The project setup is not yet fully verified because database migration and persistence could not be tested without valid credentials. The README has also not yet been tested by an unfamiliar human.

This report records the agent-assisted test and its limitations honestly. It should not be treated as a replacement for the required human usability test.