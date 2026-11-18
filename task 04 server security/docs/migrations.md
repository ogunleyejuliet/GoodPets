# Database Migration Strategy and Safety

## 1. Purpose

This document explains the database migration process used during Task 4 of the Good Pets project.

The objective was to practise making database changes safely while preserving existing data, detecting schema drift, and avoiding destructive changes.

All migration exercises were performed against the local PostgreSQL database `task4_migrations_lab`.

## 2. Existing Migration Structure

The project uses Prisma ORM with PostgreSQL.

The migration history includes:

| Migration | Purpose |
|---|---|
| `0_init_user_auth` | Initial user and authentication database structure |
| `1_capacity_and_bookings` | Booking, capacity and related database structures |
| `2_add_customer_id` | Adds the customer ID field and its database constraints |

The migrations are stored in:

`prisma/migrations/`

Prisma CLI version used: `6.4.1`.

The migrations were applied to the local database using:

```bash
npx prisma migrate deploy
```

The database migration status was subsequently checked to confirm that the migrations had been applied.

## 3. Inspecting the Existing Database

Before making migration changes, the existing database structure was inspected.

This was important because migration decisions should be based on the actual database state rather than assumptions about what tables or columns exist.

The baseline inspection covered:

- Existing tables and columns.
- Column types and nullability.
- Primary and foreign keys.
- Unique constraints.
- Database indexes.
- Existing customer and authentication data.

The initial database state was captured as part of the migration evidence.

**Evidence:** `02-database-state-before.png`

## 4. Migration Exercise: Initial Migration

The existing migration history was applied to the local PostgreSQL database.

Command:

```bash
npx prisma migrate deploy
```

This applied the pending migrations without using `prisma db push`.

The migration process was checked to confirm that the database reached the expected migration state.

**Evidence:** `03-initial-migration.txt`

## 5. Migration Exercise: Adding a Required Column

A demonstration was performed to show what happens when a required column is added to a table that already contains records.

The test table contained three existing records:

- Max
- Bella
- Charlie

An attempt was made to add a new `vaccination_status` column as `NOT NULL` without providing a value for the existing records.

PostgreSQL rejected the operation because the existing rows would contain NULL values in a column that does not permit NULL.

This demonstrated why adding a required column directly to a populated table can fail.

**Evidence:** `04-required-column-failure.txt`

## 6. Safe Three-Step Migration Recovery

The failed migration exercise was corrected using a three-step approach.

### Step 1: Add the column as nullable

The column was first added without a `NOT NULL` constraint.

This allowed the existing records to remain valid while the new column was introduced.

### Step 2: Backfill existing records

The existing records were updated with a valid default value:

`NOT_RECORDED`

This ensured that every existing record had a value before the column became mandatory.

### Step 3: Enforce NOT NULL

After confirming that the existing records had been populated, the column was changed to `NOT NULL`.

All three original records were preserved.

This approach avoids the failure that occurs when a required column is added to a populated table without a backfill.

**Evidence:** `05-required-column-three-steps.txt`

## 7. Schema Drift Detection

Schema drift occurs when the actual database structure differs from the structure represented by the migration history or expected schema.

A demonstration was performed by creating a temporary database table outside the normal migration process.

The schema difference was detected using Prisma's migration diff functionality.

The temporary demonstration table was then removed, and the comparison was repeated.

The subsequent comparison reported:

`No difference detected`

This demonstrated how an unexpected database change can be identified and corrected.

**Evidence:** `06-drift-error.txt`

## 8. Migration Safety Decisions

The following principles guided the migration exercises:

1. Inspect the existing database before making structural changes.
2. Preserve existing records when adding or changing columns.
3. Use nullable columns and backfill data before enforcing new required constraints.
4. Review migration SQL before applying changes.
5. Detect and investigate schema drift rather than ignoring it.
6. Avoid making unreviewed destructive database changes.
7. Keep migration history consistent with the database.

The exercises used a local test database so that migration failures and recovery procedures could be demonstrated without affecting production data.

## 9. Rollback and Recovery Strategy

Prisma migrations are treated as forward-moving database changes. A database migration should not be assumed to have an automatically generated down migration.

For this project, recovery decisions must consider the actual state of the database and the migration that was applied.

The demonstrated required-column recovery used a safe sequence of forward changes rather than deleting existing records.

Before applying future migrations:

- Inspect the generated SQL.
- Confirm the target database.
- Back up important data where appropriate.
- Check whether existing records satisfy new constraints.
- Prepare a recovery plan for potentially destructive changes.

No automatic rollback mechanism is claimed as implemented by these exercises.

## 10. Database Environment Safety

Task 4 migration exercises were performed using the local PostgreSQL database:

`task4_migrations_lab`

The project also has historical Supabase configuration, but the migration exercises described in this document refer to the local database.

Migration commands must only be run after confirming that the database connection points to the intended environment.

## 11. Conclusion

The migration exercises demonstrated:

- Applying existing Prisma migrations.
- Understanding why required-column changes can fail.
- Recovering safely through a nullable-column, backfill and constraint-enforcement sequence.
- Detecting and resolving schema drift.
- Preserving existing database records during structural changes.

These practices help reduce data loss, migration failures and inconsistencies between the application and its database.