---
trigger: glob
globs: "**/prisma/**, **/*.sql, **/db/**, **/*{prisma,migration}*.{ts,tsx}"
description: Prisma, pgvector, SQL migration, transactions and connection rules for Good Pets.
---

# Database and migrations

Job: how the code talks to PostgreSQL and which guarantees must live in the database.

1. Use Prisma for normal reads and writes. Read and write vector columns with `$queryRaw` and `$executeRaw` using bound parameters, never string joins. Reason: the Prisma client cannot see vector columns, and string joins invite SQL injection.
2. Match the schema to PRD 10.1. Do not add a model or field without a requirement. Reason: the data model is a decision the owner made.
3. The capacity guarantee and several others are not in Prisma. They live in one SQL migration (PRD 10.1.1): the reserved-within-capacity check, one SUCCEEDED payment per booking, one INITIATED payment per booking, the booking total check, the check-out needs a collector rule and the pgvector extension. Reason: without it, the app only hopes to be correct.
4. Do not claim capacity or payment safety until the owner has applied that migration. Tell the owner it is needed and write it when asked. Reason: code alone cannot stop two requests from overbooking.
5. Enforce rules with constraints and unique indexes, not only in code. Reason: concurrency and bugs get past code checks.
6. Keep transactions short. Make no call to Paystack, OpenAI or Resend inside one. Reason: an open transaction holds locks and connections, and a rollback cannot undo an outside call.
7. Use one shared Prisma client per runtime and the pooled connection string. Put the function region next to the database region. Reason: serverless functions run out of connections.
8. Never delete or edit bookings, payments, handover records or audit events in application code. The audit log is append-only. Archive pets that have bookings. Reason: these are the business's evidence. Deletion on request anonymises personal fields and is done by the owner, not by a screen (BR-040).
9. Test database rules against a real PostgreSQL with pgvector. Reason: constraints and locks do not exist in a mock.