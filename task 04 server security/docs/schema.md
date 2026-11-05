# GoodPets — Database Schema Specification

**Task:** Ship & Found — Task 4, Step 1: Database Schema Design  
**File:** `task-04-server-security/docs/schema.md`  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Schema source:** `prisma/schema.prisma`  
**Status:** Updated proposed schema specification

---

## 1. Purpose and scope

This document specifies the GoodPets database architecture for Task 4, Step 1. It describes the 15 database models, their fields, data types, nullability, defaults, constraints, relationships, indexes and data-integrity rules.

The design supports:

- Customer and staff accounts.
- Stateful authentication sessions and one-time authentication tokens.
- Pet profiles.
- Service configuration, pricing and closure management.
- Capacity management and booking reservations.
- Payment obligations and individual gateway attempts.
- Paystack webhook processing and financial audit records.
- Knowledge-base documents and vector embeddings for retrieval.

The schema is designed around PostgreSQL and Prisma. PostgreSQL-specific functionality, including CHECK constraints and pgvector, is implemented through SQL migrations where required.

**Implementation distinction:** The Prisma schema and existing migration files are separate sources of information. A constraint appearing in Prisma does not mean it has already been applied to the live database. The owner executes database migrations.

## 2. Architectural decisions

### 2.1 One Payment per Booking

A Booking has an optional one-to-one relationship with Payment:

- `Booking.payment Payment?`
- `Payment.bookingId String @unique`

This enforces at most one Payment record per Booking. Once payment initialization occurs, that record represents the booking's financial obligation.

A Payment can have multiple PaymentAttempt records. Retrying checkout creates another attempt rather than another parent Payment.

This separates the financial obligation from individual interactions with the payment gateway.

### 2.2 PaymentAttempt execution and reconciliation

PaymentAttempt records preserve individual gateway interactions, including successful, failed and abandoned attempts.

Two separate lifecycles are represented:

- **Gateway execution status:** Whether an individual payment attempt was initiated, succeeded, failed or abandoned.
- **Financial reconciliation status:** How a successful charge was applied to a booking or requires further resolution.

Keeping attempts separate preserves failed and abandoned checkout information. This has two important purposes:

1. Business analysis: failed and abandoned attempts reveal where customers drop out of the payment process and where potential revenue is lost.
2. Financial audit: individual gateway interactions provide a transaction history for disputes, government inquiries and annual tax reporting.

A failed or abandoned attempt must not be interpreted as proof that money was collected.

### 2.3 Audit-preserving settlement reference

Payment contains an optional `settlementAttemptId` pointing to the specific PaymentAttempt selected as the settling attempt.

The relation uses `onDelete: Restrict` to prevent deletion of the referenced attempt through this relationship.

The selected settlement attempt must belong to the same Payment. The ordinary foreign key does not independently enforce this cross-relation rule; application logic must verify it.

### 2.4 Database-backed sessions

Session records provide server-side session tracking.

The database stores a SHA-256 hash of the session secret rather than the raw secret. The session also stores its user, version, expiry and activity timestamps.

The application checks the session record and compares its version against `User.sessionVersion`. Incrementing the user's session version supports global session invalidation.

Activity updates are throttled to approximately 15-minute intervals to reduce unnecessary database writes.

### 2.5 Knowledge base and vector embeddings

KnowledgeDocument stores draft and published knowledge-base content.

KnowledgeChunk stores versioned document segments and their vector embeddings. PostgreSQL's `vector(1536)` type supports similarity-search operations.

The embedding column uses Prisma's `Unsupported("vector(1536)")` type because the PostgreSQL vector type is not represented as a standard Prisma scalar. Vector operations use raw SQL.

---

## 3. Complete enum inventory

| Enum | Values | Purpose |
|---|---|---|
| `Role` | CUSTOMER, FRONT_DESK, MANAGER | User access roles |
| `AuthTokenPurpose` | EMAIL_VERIFICATION, PASSWORD_RESET | One-time authentication token purpose |
| `Species` | DOG, CAT | Pet species |
| `ServiceType` | GROOMING, DAYCARE, BOARDING | Available service categories |
| `GroomingPackage` | BASIC, FULL, PREMIUM | Grooming package selection |
| `SizeTier` | SMALL, MEDIUM, LARGE | Pet size classification |
| `BookingStatus` | PENDING_PAYMENT, CONFIRMED, NEEDS_ATTENTION, EXPIRED, COMPLETED, NO_SHOW | Booking lifecycle |
| `PaymentStatus` | INITIATED, SUCCEEDED, FAILED, ABANDONED | Overall payment obligation status |
| `PaymentAttemptStatus` | INITIATED, SUCCEEDED, FAILED, ABANDONED | Individual gateway attempt status |
| `PaymentAttemptReconciliation` | UNRECONCILED, APPLIED, DUPLICATE, UNAPPLIED, REFUND_PENDING, RECONCILED | Financial exception and settlement tracking |
| `WebhookStatus` | RECEIVED, PROCESSED, IGNORED, FAILED | Webhook processing lifecycle |

---

## 4. Model specifications

The following tables document all 15 models.

### 4.1 User

**Purpose:** Stores customer and staff accounts, authentication information, account status and relationships to user-owned records.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| customerId | VARCHAR(4) | Yes | Unique |
| email | String | No | Unique |
| emailVerified | DateTime | Yes | None |
| passwordHash | String | Yes | None |
| sessionVersion | Int | No | Default 1 |
| name | String | Yes | None |
| phone | String | Yes | None |
| role | Role | No | Default CUSTOMER |
| isActive | Boolean | No | Default true |
| anonymizedAt | DateTime | Yes | None |
| createdAt | DateTime | No | Default now |
| updatedAt | DateTime | No | Automatically updated |

**Relationships**

- One User can have many Sessions.
- One User can have many AuthTokens.
- One User can own many Pets.
- One User can create many Bookings.
- One User can create many Closures.
- One User can publish many KnowledgeDocuments.

**Delete behaviour**

- Sessions: Cascade.
- AuthTokens: Cascade.
- Pets: Restrict.
- Bookings: Restrict.
- Closures: Restrict.
- Published documents: SetNull.

**Important application rules**

- Email addresses are normalized to lowercase by the application.
- `customerId` is intended to be a unique four-digit customer identifier.
- `@db.VarChar(4)` and `@unique` do not independently enforce numeric characters or the 1000–9999 range.
- `passwordHash` stores an Argon2id password hash, never a plaintext password.
- `sessionVersion` supports global session invalidation.

### 4.2 Session

**Purpose:** Stores server-side session records for authenticated users.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| userId | String | No | Foreign key to User |
| sessionTokenHash | String | No | Unique |
| sessionVersion | Int | No | Default 1 |
| ipAddress | String | Yes | None |
| userAgent | String | Yes | None |
| expiresAt | DateTime | No | None |
| lastActiveAt | DateTime | No | Default now |
| createdAt | DateTime | No | Default now |

**Relationship:** Many Sessions belong to one User.

**Delete behaviour:** Deleting a User cascades to their Sessions.

**Security rules**

- Store the SHA-256 hash of the session secret, not the raw token.
- Validate the session record, expiry, user activity and session version during authentication.
- Throttle `lastActiveAt` updates to reduce write load.
- Expired sessions can be identified through the expiry index for cleanup.

### 4.3 AuthToken

**Purpose:** Stores hashed one-time tokens used for email verification and password reset.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| userId | String | No | Foreign key to User |
| purpose | AuthTokenPurpose | No | None |
| tokenHash | String | No | Unique |
| expiresAt | DateTime | No | None |
| usedAt | DateTime | Yes | None |
| createdAt | DateTime | No | Default now |

**Relationship:** Many AuthTokens belong to one User.

**Delete behaviour:** Cascade when the User is deleted.

**Security rules**

- Store only the token hash.
- Verify expiry before redemption.
- Reject tokens that have already been used.
- Separate token purposes so that a password-reset token cannot be used as an email-verification token.

### 4.4 Pet

**Purpose:** Stores customer pet profiles and information required for service eligibility and booking.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| ownerId | String | No | Foreign key to User |
| name | String | No | None |
| species | Species | No | DOG or CAT |
| breed | String | Yes | None |
| weightKg | Decimal(4,1) | Yes | None |
| careNotes | String | Yes | None |
| archivedAt | DateTime | Yes | None |
| createdAt | DateTime | No | Default now |
| updatedAt | DateTime | No | Automatically updated |

**Relationships**

- Many Pets belong to one User.
- One Pet can be associated with many Bookings.

**Delete behaviour**

- User deletion: Restrict.
- Booking deletion: Restrict on the Pet side.

**Integrity rule**

The booking application must verify that the selected pet belongs to the authenticated customer:

`Pet.ownerId === Booking.customerId`

The server performs this check before creating a booking or reserving capacity. This prevents a customer from booking another customer's pet by submitting a different pet ID.

### 4.5 ServiceConfig

**Purpose:** Stores service-level scheduling and capacity configuration.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| serviceType | ServiceType | No | Primary key |
| defaultCapacity | Int | No | None |
| slotTimes | String[] | No | None |
| opensAt | String | No | Default `08:00` |
| closesAt | String | No | Default `20:00` |
| updatedAt | DateTime | No | Automatically updated |

**Relationships:** No direct foreign-key relationships.

**Purpose of configuration**

- Defines the service category.
- Stores default capacity.
- Stores available slot times.
- Stores service opening and closing times.

Time strings are interpreted by the application using the business's Lagos timezone.

### 4.6 PriceItem

**Purpose:** Stores configurable service prices.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| priceKey | String | No | Unique |
| serviceType | ServiceType | No | None |
| species | Species | Yes | None |
| groomingPackage | GroomingPackage | Yes | None |
| sizeTier | SizeTier | Yes | None |
| amountKobo | Int | No | None |
| isActive | Boolean | No | Default true |
| updatedAt | DateTime | No | Automatically updated |

**Relationships:** No direct foreign-key relationships.

**Pricing rules**

- Amounts are stored as integer kobo to avoid floating-point currency calculations.
- The application resolves the appropriate price using the service, species, package and size tier.
- Inactive pricing records are excluded from normal price resolution.
- Valid combinations of service, species, package and size tier are enforced by application validation unless additional database constraints are introduced.

### 4.7 Closure

**Purpose:** Stores service-specific or general closure periods during which bookings are unavailable.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| serviceType | ServiceType | Yes | Null means general closure |
| startDate | Date | No | PostgreSQL DATE |
| endDate | Date | No | PostgreSQL DATE |
| message | String | Yes | None |
| createdById | String | No | Foreign key to User |
| createdAt | DateTime | No | Default now |

**Relationship:** Many Closures can be created by one User.

**Delete behaviour:** Restrict deletion of a User who created a Closure.

**Date handling:** Closure dates are calendar dates interpreted in the Lagos business timezone.

### 4.8 CapacityUnit

**Purpose:** Stores the available and reserved capacity for a service on a particular date and slot.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| serviceType | ServiceType | No | None |
| serviceDate | Date | No | PostgreSQL DATE |
| slotCode | String | No | None |
| capacity | Int | No | None |
| reserved | Int | No | Default 0 |

**Relationships**

- One CapacityUnit can have many BookingUnits.

**Constraints**

- Unique combination of `serviceType`, `serviceDate` and `slotCode`.
- PostgreSQL CHECK constraint: `reserved >= 0 AND reserved <= capacity`.

**Application enforcement**

Capacity reservation uses an atomic conditional database update. The increment succeeds only when the resulting reserved count does not exceed capacity.

Capacity release uses a guarded decrement to prevent negative reservation counts.

**Verified migration constraint**

The existing migration `prisma/migrations/1_capacity_and_bookings/migration.sql` contains:

```sql
ALTER TABLE "CapacityUnit"
ADD CONSTRAINT capacity_unit_reserved_within_capacity
CHECK ("reserved" >= 0 AND "reserved" <= "capacity");
```

### 4.9 Booking

**Purpose:** Stores customer reservations, booking status, service details, pet snapshots and payment amounts.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| reference | String | No | Unique |
| idempotencyKey | String | No | None |
| customerId | String | No | Foreign key to User |
| petId | String | No | Foreign key to Pet |
| serviceType | ServiceType | No | None |
| groomingPackage | GroomingPackage | Yes | None |
| slotCode | String | Yes | None |
| status | BookingStatus | No | Default PENDING_PAYMENT |
| startDate | Date | No | PostgreSQL DATE |
| endDate | Date | No | PostgreSQL DATE |
| quantity | Int | No | None |
| petNameSnapshot | String | No | None |
| petSpeciesSnapshot | Species | No | None |
| petWeightKgSnapshot | Decimal(4,1) | Yes | None |
| sizeTierSnapshot | SizeTier | Yes | None |
| unitPriceKobo | Int | No | None |
| totalKobo | Int | No | PostgreSQL CHECK constraint |
| currency | String | No | Default NGN |
| holdExpiresAt | DateTime | Yes | None |
| confirmedAt | DateTime | Yes | None |
| rescheduleCount | Int | No | Default 0 |
| createdAt | DateTime | No | Default now |
| updatedAt | DateTime | No | Automatically updated |

**Relationships**

- Many Bookings belong to one User.
- Many Bookings can reference one Pet.
- One Booking can have many BookingUnits.
- One Booking has zero or one Payment.

**Delete behaviour**

- User deletion: Restrict.
- Pet deletion: Restrict.
- Booking deletion cascades to its BookingUnits.
- Payment deletion is restricted by the Payment-to-Booking relation.

**Unique constraints**

- `reference`
- Composite unique: `[customerId, idempotencyKey]`

**Financial integrity**

The booking amount is calculated server-side:

`totalKobo = unitPriceKobo × quantity`

The client cannot determine the authoritative total by submitting its own amount.

**Verified migration constraint**

The existing migration contains:

```sql
ALTER TABLE "Booking"
ADD CONSTRAINT booking_total_matches
CHECK ("totalKobo" = "unitPriceKobo" * "quantity");
```

**Pet ownership integrity**

The database independently references the customer and pet. These foreign keys alone do not establish that the pet belongs to the customer.

The server therefore checks the ownership relationship before creating the booking and reserving capacity.

### 4.10 BookingUnit

**Purpose:** Links a Booking to the CapacityUnit records it reserves.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| bookingId | String | No | Foreign key to Booking |
| capacityUnitId | String | No | Foreign key to CapacityUnit |
| releasedAt | DateTime | Yes | None |

**Relationships**

- Many BookingUnits belong to one Booking.
- Many BookingUnits can reference one CapacityUnit.

This junction creates a conceptual many-to-many relationship between Bookings and CapacityUnits.

**Delete behaviour**

- Booking deletion: Cascade.
- CapacityUnit deletion: Restrict.

**Unique constraint:** `[bookingId, capacityUnitId]`

This prevents the same booking from linking to the same capacity unit more than once.

`releasedAt` records when a reservation was released. The reservation history can therefore be retained separately from the current capacity count.

### 4.11 Payment

**Purpose:** Stores the authoritative financial obligation for a Booking and the summary of its payment outcome.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| bookingId | String | No | Unique foreign key to Booking |
| reference | String | No | Unique |
| amountKobo | Int | No | None |
| currency | String | No | Default NGN |
| status | PaymentStatus | No | Default INITIATED |
| settlementAttemptId | String | Yes | Unique foreign key to PaymentAttempt |
| channel | String | Yes | None |
| paystackTransactionId | String | Yes | None |
| accessCode | String | Yes | None |
| gatewayResponse | String | Yes | None |
| verifySummary | Json | Yes | None |
| initiatedAt | DateTime | No | Default now |
| paidAt | DateTime | Yes | None |
| verifiedAt | DateTime | Yes | None |

**Relationships**

- Each Payment belongs to one Booking.
- Each Booking has at most one Payment.
- One Payment can have many PaymentAttempts.
- A Payment can optionally reference one settlement attempt.

**Delete behaviour**

- Booking deletion: Restrict.
- Settlement-attempt deletion: Restrict.
- Payment deletion: Restrict while attempts reference it.

**Unique constraints**

- `bookingId`
- `reference`
- `settlementAttemptId`

**Important design distinction**

Payment represents the overall financial obligation. PaymentAttempt represents each individual gateway checkout interaction.

The Payment record contains summary information, while PaymentAttempt preserves the history of individual gateway interactions.

The settlement reference protects the identity of the attempt selected as the authoritative settlement. Application logic must also verify that the selected attempt belongs to the same Payment.

### 4.12 PaymentAttempt

**Purpose:** Stores individual Paystack checkout attempts and their execution and reconciliation outcomes.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| paymentId | String | No | Foreign key to Payment |
| attemptNumber | Int | No | Default 1 |
| attemptReference | String | No | Unique |
| channel | String | Yes | None |
| status | PaymentAttemptStatus | No | Default INITIATED |
| reconciliation | PaymentAttemptReconciliation | No in supplied schema | Default UNRECONCILED |
| accountEmailSnapshot | String | Yes | None |
| paystackTransactionId | String | Yes | None |
| accessCode | String | Yes | None |
| gatewayResponse | String | Yes | None |
| errorCode | String | Yes | None |
| rawSummary | Json | Yes | None |
| ipAddress | String | Yes | None |
| initiatedAt | DateTime | No | Default now |
| completedAt | DateTime | Yes | None |

**Relationships**

- Many PaymentAttempts belong to one Payment.
- A PaymentAttempt may optionally be referenced as the settlement attempt of one Payment.

**Delete behaviour:** Restrict deletion of a Payment while attempts reference it. The settlement relation also uses Restrict.

**Unique constraints**

- `attemptReference`
- Composite unique: `[paymentId, attemptNumber]`

**Attempt references**

The parent Payment has a canonical reference. Each gateway attempt has its own unique attempt reference, allowing callbacks and webhooks to identify the specific interaction.

For example, attempts can be numbered sequentially as A1, A2 and A3.

**Reconciliation meanings**

| State | Meaning |
|---|---|
| UNRECONCILED | Successful charge awaiting application or exception handling |
| APPLIED | Successful charge selected as the authoritative booking settlement |
| DUPLICATE | Additional successful charge after the booking was already settled |
| UNAPPLIED | Successful charge could not secure the booking because the original hold expired and capacity could not be re-reserved |
| REFUND_PENDING | An approved financial resolution has been initiated and awaits confirmation |
| RECONCILED | The financial exception has been resolved and recorded |

**Consistency point requiring implementation alignment**

The supplied Prisma model currently makes `reconciliation` non-nullable and defaults it to `UNRECONCILED`.

However, the intended lifecycle states that failed and abandoned attempts do not enter financial reconciliation.

The database model and application transition logic must be kept consistent with that rule. If failed and abandoned attempts are to have no reconciliation value, the field must be nullable and the application must enforce the corresponding lifecycle.

Do not treat a failed or abandoned gateway attempt as evidence that customer funds were captured.

**Privacy and retention consideration**

`accountEmailSnapshot` preserves the account email at checkout initialization. This duplicates information held in User and may retain personal data after a User record is anonymized.

Its purpose, access restrictions, retention period and treatment during anonymization must be explicitly decided under the application's data-retention policy. It should not be described as a universally required statutory financial record.

### 4.13 WebhookEvent

**Purpose:** Stores Paystack webhook delivery and processing records to support deduplication, retries and operational investigation.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| provider | String | No | Default paystack |
| dedupeKey | String | No | Unique |
| eventType | String | No | None |
| reference | String | Yes | None |
| payloadSummary | Json | No | None |
| status | WebhookStatus | No | Default RECEIVED |
| error | String | Yes | None |
| receivedAt | DateTime | No | Default now |
| processedAt | DateTime | Yes | None |

**Relationships:** No direct Prisma foreign-key relationships.

**Unique constraint:** `dedupeKey`

**Processing lifecycle**

- RECEIVED: Event has been received.
- PROCESSED: Event processing completed.
- IGNORED: Event was deliberately not applied.
- FAILED: Event processing failed.

**Data handling**

`payloadSummary` is intended to contain a whitelist of relevant event fields rather than an unrestricted raw gateway payload.

Webhook signature verification occurs when the request is received. The retained summary is not, by itself, independent proof that the original signature was valid.

This model is a delivery and processing log with lifecycle updates. It should not be described as strictly append-only because status, error and processing timestamps can change.

### 4.14 KnowledgeDocument

**Purpose:** Stores the GoodPets knowledge-base content used by the AI assistant.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| slug | String | No | Unique |
| title | String | No | None |
| draftBody | String | No | None |
| publishedBody | String | Yes | None |
| publishedVersion | Int | No | Default 0 |
| publishedAt | DateTime | Yes | None |
| publishedById | String | Yes | Foreign key to User |
| createdAt | DateTime | No | Default now |
| updatedAt | DateTime | No | Automatically updated |

**Relationships**

- A KnowledgeDocument may have one publishing User.
- One User can publish many KnowledgeDocuments.
- One KnowledgeDocument can have many KnowledgeChunks.

**Delete behaviour**

- Deleting the publishing User sets `publishedById` to null.
- Deleting a KnowledgeDocument cascades to its KnowledgeChunks.

**Purpose of separate content fields**

`draftBody` stores editable content, while `publishedBody` stores the published version. This separates work in progress from content approved for use by the AI assistant.

### 4.15 KnowledgeChunk

**Purpose:** Stores versioned knowledge-base chunks and their vector embeddings.

| Field | Database type | Nullable | Constraint / default |
|---|---|---:|---|
| id | String | No | Primary key; `cuid()` |
| documentId | String | No | Foreign key to KnowledgeDocument |
| version | Int | No | None |
| chunkIndex | Int | No | None |
| heading | String | Yes | None |
| content | String | No | None |
| embedding | vector(1536) | No | PostgreSQL pgvector |
| embeddingModel | String | No | None |
| createdAt | DateTime | No | Default now |

**Relationship:** Many KnowledgeChunks belong to one KnowledgeDocument.

**Delete behaviour:** Deleting a KnowledgeDocument cascades to its KnowledgeChunks.

**Unique constraint:** `[documentId, version, chunkIndex]`

**Index:** `[documentId, version]`

**Vector implementation**

- The embedding is a PostgreSQL `vector(1536)`.
- Prisma represents it using `Unsupported("vector(1536)")`.
- The migration provides the PostgreSQL vector type.
- Vector reads and writes are performed using raw SQL.
- The embedding model identifier is retained alongside the vector to identify how it was generated.

---

## 5. Relationship and cardinality inventory

| Parent | Child | Cardinality | Foreign key / relation | Delete behaviour |
|---|---|---|---|---|
| User | Session | 1:N | Session.userId | Cascade |
| User | AuthToken | 1:N | AuthToken.userId | Cascade |
| User | Pet | 1:N | Pet.ownerId | Restrict |
| User | Booking | 1:N | Booking.customerId | Restrict |
| User | Closure | 1:N | Closure.createdById | Restrict |
| User | KnowledgeDocument | 1:N | KnowledgeDocument.publishedById | SetNull |
| Pet | Booking | 1:N | Booking.petId | Restrict |
| Booking | BookingUnit | 1:N | BookingUnit.bookingId | Cascade |
| CapacityUnit | BookingUnit | 1:N | BookingUnit.capacityUnitId | Restrict |
| Booking | Payment | 1:0..1 | Payment.bookingId | Restrict |
| Payment | PaymentAttempt | 1:N | PaymentAttempt.paymentId | Restrict |
| Payment | Settlement PaymentAttempt | 1:0..1 | Payment.settlementAttemptId | Restrict |
| KnowledgeDocument | KnowledgeChunk | 1:N | KnowledgeChunk.documentId | Cascade |

**Many-to-many relationship**

Booking and CapacityUnit have a conceptual many-to-many relationship implemented through BookingUnit:

- One Booking can reserve multiple CapacityUnits.
- One CapacityUnit can be referenced by multiple BookingUnits over its lifecycle.
- The junction model preserves the relationship and release timestamp.

There are no direct many-to-many relations in the Prisma schema.

---

## 6. Complete index inventory

Indexes support authentication, booking lookup, idempotency, capacity allocation, payment reconciliation, webhook deduplication and knowledge retrieval.

Primary-key indexes are created automatically by PostgreSQL for every model's primary key. Unique constraints also create backing unique indexes.

The table below lists the unique and explicit secondary indexes defined in the schema.

| Model | Indexed columns | Type | Operational purpose | Write overhead |
|---|---|---|---|---|
| User | customerId | UNIQUE | Staff lookup using customer identifier | Maintained on insert/update |
| User | email | UNIQUE | Authentication lookup | Maintained on insert/update |
| User | role | B-tree | Role-based filtering | Additional maintenance on role changes |
| Session | sessionTokenHash | UNIQUE | Session lookup during authentication | Maintained on session creation |
| Session | userId | B-tree | User session lookup and deletion | Additional maintenance |
| Session | expiresAt | B-tree | Expired-session cleanup | Additional maintenance |
| AuthToken | tokenHash | UNIQUE | One-time token lookup | Maintained on token creation |
| AuthToken | userId, purpose | B-tree | Token issuance and purpose lookup | Additional maintenance |
| AuthToken | expiresAt | B-tree | Expired-token cleanup | Additional maintenance |
| Pet | ownerId | B-tree | Listing a customer's pets | Additional maintenance |
| PriceItem | priceKey | UNIQUE | Price resolution by canonical key | Maintained on insert/update |
| PriceItem | serviceType | B-tree | Service-specific price listing | Additional maintenance |
| Closure | startDate, endDate | B-tree | Closure date-range checks | Additional maintenance |
| CapacityUnit | serviceType, serviceDate, slotCode | UNIQUE | Prevent duplicate service/date/slot records | Maintained on insert/update |
| CapacityUnit | serviceDate | B-tree | Date-range availability lookup | Additional maintenance |
| Booking | reference | UNIQUE | Public booking-reference lookup | Maintained on insert |
| Booking | customerId, idempotencyKey | UNIQUE | Prevent duplicate booking submissions | Maintained on insert |
| Booking | customerId, startDate | B-tree | Customer booking history | Additional maintenance |
| Booking | status, holdExpiresAt | B-tree | Finding expired payment holds | Additional maintenance |
| Booking | startDate | B-tree | Daily booking and arrival queries | Additional maintenance |
| BookingUnit | bookingId, capacityUnitId | UNIQUE | Prevent duplicate junction records | Maintained on insert |
| BookingUnit | capacityUnitId | B-tree | Reverse lookup of reservations | Additional maintenance |
| Payment | bookingId | UNIQUE | Enforce at most one Payment per Booking | Maintained on insert |
| Payment | reference | UNIQUE | Canonical payment-reference lookup | Maintained on insert |
| Payment | settlementAttemptId | UNIQUE | At-most-one selected settlement link per attempt | Maintained on settlement changes |
| Payment | status, initiatedAt | B-tree | Payment status and stale-payment queries | Additional maintenance |
| PaymentAttempt | attemptReference | UNIQUE | Resolve individual gateway attempts | Maintained on insert |
| PaymentAttempt | paymentId, attemptNumber | UNIQUE | Prevent duplicate attempt numbers | Maintained on insert |
| PaymentAttempt | paystackTransactionId | B-tree | Gateway transaction reconciliation | Additional maintenance |
| PaymentAttempt | paymentId, reconciliation | B-tree | Find unresolved payment exceptions | Additional maintenance |
| WebhookEvent | dedupeKey | UNIQUE | Webhook deduplication | Maintained on event receipt |
| WebhookEvent | receivedAt | B-tree | Chronological event lookup and cleanup | Additional maintenance |
| KnowledgeDocument | slug | UNIQUE | Document lookup | Maintained on insert/update |
| KnowledgeChunk | documentId, version, chunkIndex | UNIQUE | Prevent duplicate chunks within a version | Maintained on publish |
| KnowledgeChunk | documentId, version | B-tree | Retrieve chunks for a document version | Maintained on insert |

**Index design considerations**

Indexes improve lookup performance but introduce write overhead. Inserts and updates affecting indexed columns require corresponding index maintenance.

Unique indexes additionally enforce uniqueness. For this reason, indexes should support identifiable application queries and integrity requirements rather than being added indiscriminately.

The unique `Payment.bookingId` index replaces the former standalone `@@index([bookingId])`; a second ordinary index on the same column is unnecessary.

The index list does not imply that every possible query has a dedicated index. Query plans and workload should guide any future additions.

---

## 7. Database constraints and application-level invariants

Not every integrity rule can be expressed by the Prisma schema alone.

The following table distinguishes the enforcement mechanism.

| Integrity rule | Enforcement | Verification / location |
|---|---|---|
| User email uniqueness | PostgreSQL unique constraint | `User.email @unique` |
| Customer ID uniqueness | PostgreSQL unique constraint | `User.customerId @unique` |
| Session secret hash uniqueness | PostgreSQL unique constraint | `Session.sessionTokenHash @unique` |
| Authentication token hash uniqueness | PostgreSQL unique constraint | `AuthToken.tokenHash @unique` |
| One Payment per Booking | Prisma unique constraint; database after migration | `Payment.bookingId @unique` |
| Unique booking reference | PostgreSQL unique constraint | `Booking.reference @unique` |
| Booking idempotency | PostgreSQL composite unique constraint | `[customerId, idempotencyKey]` |
| Capacity cannot be negative or exceed maximum | PostgreSQL CHECK and application atomic update | `capacity_unit_reserved_within_capacity`; `src/lib/capacity.ts` |
| Booking total equals unit price multiplied by quantity | PostgreSQL CHECK and server-side calculation | `booking_total_matches`; `src/lib/capacity.ts` |
| Pet belongs to authenticated customer | Server-side application validation | `src/lib/capacity.ts` |
| Settlement attempt belongs to its Payment | Application-level validation required | Payment settlement transaction |
| Email is normalized to lowercase | Application-level validation | Authentication and registration logic |
| Customer ID is numeric and in the intended range | Application-level validation unless an additional CHECK is introduced | Customer ID allocation logic |
| PaymentAttempt reconciliation matches gateway status | Application-level lifecycle validation | Payment attempt transition logic |
| Valid PriceItem field combinations | Application-level validation | Price resolution logic |

### 7.1 Capacity CHECK constraint

The existing migration contains:

```sql
ALTER TABLE "CapacityUnit"
ADD CONSTRAINT capacity_unit_reserved_within_capacity
CHECK ("reserved" >= 0 AND "reserved" <= "capacity");
```

This protects the database against invalid reservation counts, including writes that bypass application validation.

The application additionally performs an atomic conditional increment so concurrent requests cannot reserve beyond available capacity.

### 7.2 Booking amount CHECK constraint

The existing migration contains:

```sql
ALTER TABLE "Booking"
ADD CONSTRAINT booking_total_matches
CHECK ("totalKobo" = "unitPriceKobo" * "quantity");
```

The application independently calculates the total using server-resolved pricing and booking quantity.

This protects against client-supplied totals and prevents inconsistent booking amounts from being persisted.

### 7.3 Pet ownership validation

The Booking foreign keys independently establish that:

- The customer exists.
- The pet exists.

They do not prove that the pet belongs to that customer.

The booking creation logic therefore performs an ownership-scoped lookup:

```ts
const pet = await prisma.pet.findFirst({
  where: {
    id: petId,
    ownerId: customerId,
    archivedAt: null,
  },
});
```

If no matching pet exists, the operation is rejected before capacity reservation or booking creation.

This check must remain on the server and must use the authenticated user's ID rather than trusting a customer ID supplied by the client.

### 7.4 Settlement-attempt integrity

The `Payment.settlementAttemptId` relation references a PaymentAttempt, but the ordinary foreign key only proves that the attempt exists.

It does not prove that the attempt's `paymentId` equals the parent Payment's ID.

The payment settlement transaction must verify that both records belong together before updating the settlement reference.

A custom composite database foreign key could provide additional protection, but it is not represented by the supplied Prisma relation.

---

## 8. Data stored more than once and reasons

Some information is intentionally represented in multiple models. Each duplication has a defined purpose.

| Data | Where it appears | Reason for duplication | Authoritative source |
|---|---|---|---|
| Customer identity | User and Booking.customerId | Booking retains its customer relationship | User |
| Pet identity | Pet and Booking pet snapshots | Preserve the pet details used when the booking was made | Pet for current profile; Booking for historical snapshot |
| Pet name | Pet.name and Booking.petNameSnapshot | Historical booking record should not change when a pet is renamed | Pet for current name; Booking for booking-time name |
| Pet species | Pet.species and Booking.petSpeciesSnapshot | Preserve the species associated with the original booking | Pet for current profile; Booking for booking-time species |
| Pet weight | Pet.weightKg and Booking.petWeightKgSnapshot | Preserve booking-time weight and size calculation context | Pet for current weight; Booking for historical value |
| Price | PriceItem.amountKobo and Booking.unitPriceKobo | Booking price is frozen when the booking is created | PriceItem for current configured price; Booking for agreed booking price |
| Booking total | Booking.unitPriceKobo, quantity and totalKobo | Persist the agreed total and enforce arithmetic consistency | Booking's calculated total |
| Payment reference | Payment.reference and PaymentAttempt.attemptReference | Identify the overall payment obligation and each separate gateway interaction | Payment for canonical obligation; PaymentAttempt for individual interaction |
| Payment outcome | Payment.status and PaymentAttempt.status | Parent represents the overall obligation; attempts represent individual gateway outcomes | Each model is authoritative for its own lifecycle |
| Gateway transaction data | Payment summary and PaymentAttempt details | Parent holds selected settlement summary; attempts preserve individual gateway interactions | PaymentAttempt for attempt-level history |
| Access code | Payment.accessCode and PaymentAttempt.accessCode | Parent provides a convenient latest checkout pointer; attempt retains its own access code | PaymentAttempt |
| Account email | User.email and PaymentAttempt.accountEmailSnapshot | Preserve the account email recorded at checkout initialization | User for current account email; attempt for checkout-time snapshot |
| Published knowledge content | KnowledgeDocument.publishedBody and KnowledgeChunk.content | Store readable published content and separately indexed retrieval chunks | KnowledgeDocument for published source; chunks for retrieval representation |

### 8.1 Financial audit and historical snapshots

Booking snapshots are important because customer profiles and current service prices may change after a booking is created.

A historical booking must retain the details and amounts agreed at the time of booking. Updating a pet's name, weight or the current PriceItem must not silently rewrite that historical booking.

### 8.2 Payment summary and attempt history

The Payment record is the overall financial obligation. PaymentAttempt records preserve the gateway interactions that occurred while trying to satisfy it.

For example, a customer may start checkout, abandon it and retry successfully. The parent Payment remains one record, while each attempt preserves its own reference, gateway result and timestamps.

This allows the business to distinguish between a failed checkout and a successful charge without overwriting the earlier attempt.

### 8.3 Personal-data retention

The account email snapshot is personal data. Retaining it separately from User means an anonymization operation may not remove every copy of that email.

Its retention period, access controls, lawful basis and treatment during anonymization require an explicit privacy and retention decision. It must not be assumed that retaining this snapshot indefinitely is necessary merely because the related transaction is financially important.

---

## 9. PaymentAttempt reconciliation lifecycle

Gateway execution and financial reconciliation are separate concepts.

A gateway attempt can have one of four execution states:

- INITIATED
- SUCCEEDED
- FAILED
- ABANDONED

Financial reconciliation concerns the outcome of a successful charge.

### 9.1 Lifecycle

```text
                 Gateway execution
                        |
             +----------+----------+
             |          |          |
         INITIATED   FAILED    ABANDONED
             |
          SUCCEEDED
             |
       UNRECONCILED
             |
     +-------+--------+
     |       |        |
  APPLIED  DUPLICATE  UNAPPLIED
     |       |        |
     |       +--------+
     |            |
     |     Approved financial
     |        resolution
     |            |
     |      REFUND_PENDING
     |            |
     |     Resolution confirmed
     |            |
     |       RECONCILED
```

### 9.2 State definitions

| State | Definition |
|---|---|
| INITIATED | Gateway checkout attempt has been created. |
| SUCCEEDED | Gateway confirms a successful charge. |
| FAILED | Gateway attempt failed. This does not establish that money was collected. |
| ABANDONED | Checkout was abandoned or did not complete. This does not establish that money was collected. |
| UNRECONCILED | Successful charge awaiting application to a booking or exception handling. |
| APPLIED | Successful attempt has been selected as the authoritative settlement for the booking. |
| DUPLICATE | An additional successful charge occurred after the booking was already settled. |
| UNAPPLIED | Successful charge could not secure the booking because the hold expired and capacity could not be re-reserved. |
| REFUND_PENDING | An approved financial resolution has been initiated but is awaiting confirmation. |
| RECONCILED | The financial exception has been resolved and the outcome recorded. |

### 9.3 Important transition rules

**APPLIED**

The successful attempt is selected through `Payment.settlementAttemptId`, and the booking is confirmed following the required verification and settlement checks.

**DUPLICATE**

An additional successful charge is received after the booking has already been settled. The parent Payment remains SUCCEEDED, and the duplicate attempt is flagged for financial exception handling.

**UNAPPLIED**

A successful charge arrives after the original booking hold has expired, and capacity cannot be re-reserved. The booking is flagged as NEEDS_ATTENTION.

**UNAPPLIED to APPLIED**

This transition is permitted only when alternative capacity has actually been secured and the successful payment is formally applied to the booking. A manager changing a date without securing capacity is not sufficient.

**REFUND_PENDING and RECONCILED**

These states represent financial resolution tracking. Refunds, store credit, alternative dates and external payouts are not automatically approved by the schema.

Any financial resolution mechanism remains subject to the owner's decision on unresolved PRD question OQ-14.

### 9.4 Parent Payment status

The parent Payment represents the overall financial obligation.

A successful charge must not be hidden by a later failed or abandoned attempt. Once the obligation has been successfully settled, the parent Payment remains SUCCEEDED.

If money was collected but the booking could not be secured, the Payment can still be SUCCEEDED while the Booking is NEEDS_ATTENTION.

The application must coordinate parent and attempt status transitions transactionally.

---

## 10. Responding to a tax authority request for a transaction from 14 months earlier

If a tax authority requests information about a transaction from 14 months earlier, the business should begin with the transaction reference, Paystack transaction ID or booking reference supplied in the request. The corresponding Payment can be located through its canonical reference or its related PaymentAttempt records. The investigation should then join PaymentAttempt to Payment and Booking to identify the relevant gateway interaction, booking date, service, quantity, agreed unit price, total amount and currency. The associated WebhookEvent records can be examined using the event reference, deduplication key and transaction identifiers, alongside the retained Payment verification summary and booking-time snapshots. The business should distinguish the original gateway verification performed at ingestion from the evidence retained in the database: a whitelisted webhook payload summary does not independently prove that the original webhook signature was valid. Relevant records should be retrieved from the database and applicable backups according to the organisation's retention policy, checked for consistency and completeness, and provided through an appropriately authorised process. The response should distinguish successful charges from failed or abandoned attempts and should not present an unsuccessful attempt as collected revenue. The availability of historical records depends on the actual retention, backup and access-control arrangements.

---

## 11. Known limitations and decisions requiring explicit handling

| Area | Limitation / decision |
|---|---|
| Payment one-to-one migration | `Payment.bookingId @unique` is present in the updated Prisma schema. The database constraint must be applied through an owner-approved migration. |
| Settlement attempt ownership | The ordinary foreign key does not enforce that the selected settlement attempt belongs to the same Payment. The application must validate this. |
| PaymentAttempt reconciliation nullability | The supplied model currently makes reconciliation non-nullable with a default. This must be aligned with the intended rule that failed and abandoned attempts do not enter reconciliation. |
| Customer ID format | Four-character storage and uniqueness do not guarantee numeric values between 1000 and 9999. |
| Email normalization | Lowercase normalization is an application responsibility; uniqueness alone does not guarantee lowercase storage. |
| Pet ownership | Enforced by server-side booking validation, not by the two independent foreign keys. |
| Price combinations | Valid combinations of service, species, package and size are application-enforced unless additional database constraints are introduced. |
| Account email snapshot | Retention and anonymization treatment require a privacy decision. |
| Refunds and financial resolution | OQ-14 remains unresolved. The schema does not approve a particular refund, credit or payout policy. |
| Webhook evidence | Retained payload summaries do not independently establish the original signature verification result. |
| Retention period | No fixed statutory retention period is assumed in this schema specification. The organisation must establish its policy based on applicable requirements. |

---

## 12. Migration and implementation status

The following distinctions apply to this schema specification:

| Item | Status |
|---|---|
| 15-model Prisma design | Updated specification |
| Booking-to-Payment 1:1 Prisma relationship | Implemented in schema and application queries; validation reported successful |
| PaymentAttempt history | Represented by Payment 1:N PaymentAttempt |
| Settlement-attempt relation | Represented with unique optional reference and Restrict deletion |
| Capacity CHECK constraint | Present in existing migration SQL |
| Booking amount CHECK constraint | Present in existing migration SQL |
| Pet ownership check | Verified in server-side booking creation logic |
| Session and authentication models | Included in the proposed schema |
| KnowledgeDocument and KnowledgeChunk | Included in the proposed schema |
| New Payment.bookingId unique database constraint | Requires migration application by the owner |
| Live database state | Not asserted by this document |

The updated schema has been validated using Prisma validation, Prisma Client generation, TypeScript compilation and the reported offline unit tests.

No claim is made here that the new Payment uniqueness constraint has already been applied to the live database. Existing migration constraints and application checks must be distinguished from changes that still require migration.

---

## 13. Final schema design summary

The GoodPets database design separates account identity, authentication, pet information, booking operations, financial obligations, gateway attempts, webhook processing and knowledge retrieval into distinct models.

The 15 models are:

1. User
2. Session
3. AuthToken
4. Pet
5. ServiceConfig
6. PriceItem
7. Closure
8. CapacityUnit
9. Booking
10. BookingUnit
11. Payment
12. PaymentAttempt
13. WebhookEvent
14. KnowledgeDocument
15. KnowledgeChunk

The design uses foreign keys, unique constraints, indexes, PostgreSQL CHECK constraints and server-side validation to protect data integrity.

The most important financial design decision is that one Booking has at most one authoritative Payment, while that Payment can retain multiple PaymentAttempt records. This preserves the complete checkout history without creating multiple parent payment obligations for the same booking.

The design also preserves booking-time snapshots, supports capacity-safe reservations, records webhook processing and provides a foundation for versioned knowledge retrieval.

**This specification describes the updated proposed database design. The live database must be brought into alignment through the owner's controlled migration process.**