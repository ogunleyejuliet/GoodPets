# GoodPets Task 4, Step 1: Complete 15-Model Schema Specification

This is the definitive, approved 15-model database specification for GoodPets Task 4, Step 1. It integrates all approved architectural decisions, including:
- Option A: One `Payment` per booking with multiple `PaymentAttempt` records.
- Separate `PaymentStatus`, `PaymentAttemptStatus`, and `PaymentAttemptReconciliation` enums.
- Database-backed `Session` model storing SHA-256 token hashes with throttled sliding activity.
- Synchronization of `KnowledgeDocument` and `KnowledgeChunk` (pgvector 1536-dim embeddings) from migration 1.
- `accountEmailSnapshot` on `PaymentAttempt`.
- Full backwards compatibility with all existing application logic, active tables, and constraints.

---

## 1. Complete Enums Inventory

```prisma
enum Role {
  CUSTOMER
  FRONT_DESK
  MANAGER
}

enum AuthTokenPurpose {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

enum Species {
  DOG
  CAT
}

enum ServiceType {
  GROOMING
  DAYCARE
  BOARDING
}

enum GroomingPackage {
  BASIC
  FULL
  PREMIUM
}

enum SizeTier {
  SMALL
  MEDIUM
  LARGE
}

enum BookingStatus {
  PENDING_PAYMENT
  CONFIRMED
  NEEDS_ATTENTION
  EXPIRED
  COMPLETED
  NO_SHOW
}

enum PaymentStatus {
  INITIATED
  SUCCEEDED
  FAILED
  ABANDONED
}

enum PaymentAttemptStatus {
  INITIATED
  SUCCEEDED
  FAILED
  ABANDONED
}

enum PaymentAttemptReconciliation {
  UNRECONCILED
  APPLIED
  DUPLICATE
  UNAPPLIED
  REFUND_PENDING
  RECONCILED
}

enum WebhookStatus {
  RECEIVED
  PROCESSED
  IGNORED
  FAILED
}
```

---

## 2. Complete Prisma Schema Code (`prisma/schema.prisma`)

```prisma
// Good Pets - Prisma Schema (Task 4 Step 1 Final Approved Architecture)
// Single Source of Truth: PRD section 10.1 & Task 4 Server Security Requirements
// Database: PostgreSQL with prisma-client-js

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ==========================================
// 1. Users, Sessions and Authentication
// ==========================================

model User {
  id             String    @id @default(cuid())
  customerId     String?   @unique @db.VarChar(4)
  email          String    @unique
  emailVerified  DateTime?
  passwordHash   String?   // Argon2id hash; null for initial staff until password is set
  sessionVersion Int       @default(1) // incremented on password reset or deactivation to invalidate active JWTs
  name           String?
  phone          String?
  role           Role      @default(CUSTOMER)
  isActive       Boolean   @default(true)
  anonymizedAt   DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  sessions           Session[]
  authTokens         AuthToken[]
  pets               Pet[]
  bookings           Booking[]
  closuresCreated    Closure[]
  documentsPublished KnowledgeDocument[] @relation("DocPublishedBy")

  @@index([role])
}

model Session {
  id               String   @id @default(cuid())
  userId           String
  sessionTokenHash String   @unique // SHA-256 hex digest of the raw session secret; never the raw token
  sessionVersion   Int      @default(1) // snapshot of User.sessionVersion when session was issued
  ipAddress        String?
  userAgent        String?
  expiresAt        DateTime
  lastActiveAt     DateTime @default(now()) // updated on sliding 15-minute window to throttle write load
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model AuthToken {
  id        String           @id @default(cuid())
  userId    String
  purpose   AuthTokenPurpose
  tokenHash String           @unique // SHA-256 hex digest of the one-time token emailed to the user
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose])
  @@index([expiresAt])
}

// ==========================================
// 2. Pets
// ==========================================

model Pet {
  id         String    @id @default(cuid())
  ownerId    String
  name       String
  species    Species
  breed      String?
  weightKg   Decimal?  @db.Decimal(4, 1)
  careNotes  String?
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  owner    User      @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  bookings Booking[]

  @@index([ownerId])
}

// ==========================================
// 3. Services, Prices and Closures
// ==========================================

model ServiceConfig {
  serviceType     ServiceType @id
  defaultCapacity Int
  slotTimes       String[]
  opensAt         String      @default("08:00")
  closesAt        String      @default("20:00")
  updatedAt       DateTime    @updatedAt
}

model PriceItem {
  id              String           @id @default(cuid())
  priceKey        String           @unique
  serviceType     ServiceType
  species         Species?
  groomingPackage GroomingPackage?
  sizeTier        SizeTier?
  amountKobo      Int
  isActive        Boolean          @default(true)
  updatedAt       DateTime         @updatedAt

  @@index([serviceType])
}

model Closure {
  id          String       @id @default(cuid())
  serviceType ServiceType?
  startDate   DateTime     @db.Date
  endDate     DateTime     @db.Date
  message     String?
  createdById String
  createdAt   DateTime     @default(now())

  createdBy User @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@index([startDate, endDate])
}

// ==========================================
// 4. Capacity and Bookings
// ==========================================

model CapacityUnit {
  id          String      @id @default(cuid())
  serviceType ServiceType
  serviceDate DateTime    @db.Date
  slotCode    String
  capacity    Int
  reserved    Int         @default(0) // Check constraint: 0 <= reserved <= capacity

  bookingUnits BookingUnit[]

  @@unique([serviceType, serviceDate, slotCode])
  @@index([serviceDate])
}

model Booking {
  id                  String          @id @default(cuid())
  reference           String          @unique
  idempotencyKey      String
  customerId          String
  petId               String
  serviceType         ServiceType
  groomingPackage     GroomingPackage?
  slotCode            String?
  status              BookingStatus   @default(PENDING_PAYMENT)
  startDate           DateTime        @db.Date
  endDate             DateTime        @db.Date
  quantity            Int
  petNameSnapshot     String
  petSpeciesSnapshot  Species
  petWeightKgSnapshot Decimal?        @db.Decimal(4, 1)
  sizeTierSnapshot    SizeTier?
  unitPriceKobo       Int
  totalKobo           Int
  currency            String          @default("NGN")
  holdExpiresAt       DateTime?
  confirmedAt         DateTime?
  rescheduleCount     Int             @default(0)
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  customer User          @relation(fields: [customerId], references: [id], onDelete: Restrict)
  pet      Pet           @relation(fields: [petId], references: [id], onDelete: Restrict)
  units    BookingUnit[]
  payments Payment[]

  @@unique([customerId, idempotencyKey])
  @@index([customerId, startDate])
  @@index([status, holdExpiresAt])
  @@index([startDate])
}

model BookingUnit {
  id             String    @id @default(cuid())
  bookingId      String
  capacityUnitId String
  releasedAt     DateTime?

  booking      Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  capacityUnit CapacityUnit @relation(fields: [capacityUnitId], references: [id], onDelete: Restrict)

  @@unique([bookingId, capacityUnitId])
  @@index([capacityUnitId])
}

// ==========================================
// 5. Payments, Attempts and Webhooks
// ==========================================

model Payment {
  id                    String        @id @default(cuid())
  bookingId             String
  reference             String        @unique // Primary/authoritative payment reference
  amountKobo            Int
  currency              String        @default("NGN")
  status                PaymentStatus @default(INITIATED)
  settlementAttemptId   String?       @unique // 1:1 subset link to settling attempt
  channel               String?       // Summary channel of successful settlement
  paystackTransactionId String?       // Summary transaction ID of successful settlement
  accessCode            String?       // Access code of latest attempt
  gatewayResponse       String?
  verifySummary         Json?         // Whitelisted fields only; no customer card or bank data
  initiatedAt           DateTime      @default(now())
  paidAt                DateTime?
  verifiedAt            DateTime?

  booking           Booking         @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  settlementAttempt PaymentAttempt? @relation("SettledPaymentAttempt", fields: [settlementAttemptId], references: [id], onDelete: SetNull)
  attempts          PaymentAttempt[] @relation("PaymentAllAttempts")

  @@index([bookingId])
  @@index([status, initiatedAt])
}

model PaymentAttempt {
  id                    String                       @id @default(cuid())
  paymentId             String
  attemptNumber         Int                          @default(1)
  attemptReference      String                       @unique // Unique reference sent to Paystack
  channel               String?                      // card, bank_transfer
  status                PaymentAttemptStatus         @default(INITIATED)
  reconciliation        PaymentAttemptReconciliation @default(UNRECONCILED)
  accountEmailSnapshot  String?                      // Snapshot of User.email at checkout initialization
  paystackTransactionId String?                      // Paystack numeric transaction ID for this attempt
  accessCode            String?
  gatewayResponse       String?
  errorCode             String?
  rawSummary            Json?
  ipAddress             String?
  initiatedAt           DateTime                     @default(now())
  completedAt           DateTime?

  payment    Payment  @relation("PaymentAllAttempts", fields: [paymentId], references: [id], onDelete: Restrict)
  settledFor Payment? @relation("SettledPaymentAttempt")

  @@unique([paymentId, attemptNumber])
  @@index([paystackTransactionId])
  @@index([paymentId, reconciliation])
}

model WebhookEvent {
  id             String        @id @default(cuid())
  provider       String        @default("paystack")
  dedupeKey      String        @unique // paystack:eventType:id
  eventType      String
  reference      String?
  payloadSummary Json          // Whitelisted fields only; excludes raw PII/card data
  status         WebhookStatus @default(RECEIVED)
  error          String?
  receivedAt     DateTime      @default(now())
  processedAt    DateTime?

  @@index([receivedAt])
}

// ==========================================
// 6. Knowledge Base and Vector Records
// ==========================================

model KnowledgeDocument {
  id               String    @id @default(cuid())
  slug             String    @unique
  title            String
  draftBody        String
  publishedBody    String?
  publishedVersion Int       @default(0)
  publishedAt      DateTime?
  publishedById    String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  publishedBy User?            @relation("DocPublishedBy", fields: [publishedById], references: [id], onDelete: SetNull)
  chunks      KnowledgeChunk[]
}

model KnowledgeChunk {
  id             String                      @id @default(cuid())
  documentId     String
  version        Int
  chunkIndex     Int
  heading        String?
  content        String
  embedding      Unsupported("vector(1536)") // NOT NULL in PostgreSQL migration 1; read/write via raw SQL
  embeddingModel String
  createdAt      DateTime                    @default(now())

  document KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, version, chunkIndex])
  @@index([documentId, version])
}
```

---

## 3. Field-by-Field Inventory for All 15 Models

### 1. `User`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Unique user record ID. |
| `customerId` | `String` (`VarChar(4)`) | Yes | `@unique` | None | Unique 4-digit identifier (1000–9999). |
| `email` | `String` | No | `@unique` | None | Lowercase normalized login email. |
| `emailVerified` | `DateTime` | Yes | None | None | Link verification timestamp. |
| `passwordHash` | `String` | Yes | None | None | Argon2id hash. Null for initial staff. |
| `sessionVersion`| `Int` | No | `@default(1)` | None | Global session revocation counter. |
| `name` | `String` | Yes | None | None | Full legal customer name. |
| `phone` | `String` | Yes | None | None | Primary phone number. |
| `role` | `Role` | No | `@default(CUSTOMER)` | None | `CUSTOMER`, `FRONT_DESK`, `MANAGER`. |
| `isActive` | `Boolean` | No | `@default(true)` | None | Immediate account deactivation flag. |
| `anonymizedAt` | `DateTime` | Yes | None | None | GDPR/privacy erasure timestamp. |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Creation timestamp. |
| `updatedAt` | `DateTime` | No | `@updatedAt` | None | Modification timestamp. |
| *Relation: sessions* | `Session[]` | Yes (1:N) | None | `onDelete: Cascade` | Active user sessions. |
| *Relation: authTokens* | `AuthToken[]` | Yes (1:N) | None | `onDelete: Cascade` | Single-use verification tokens. |
| *Relation: pets* | `Pet[]` | Yes (1:N) | None | `onDelete: Restrict` | Customer pet profiles. |
| *Relation: bookings* | `Booking[]` | Yes (1:N) | None | `onDelete: Restrict` | Reservations booked by customer. |
| *Relation: closuresCreated* | `Closure[]` | Yes (1:N) | None | `onDelete: Restrict` | Closures scheduled by staff. |
| *Relation: documentsPublished*| `KnowledgeDocument[]`| Yes (1:N)| None | `onDelete: SetNull` | Docs published by manager. |

---

### 2. `Session`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Unique session ID. |
| `userId` | `String` | No | None | FK -> `User.id` (`onDelete: Cascade`) | Owning user. |
| `sessionTokenHash`| `String` | No | `@unique` | None | SHA-256 digest of session secret. |
| `sessionVersion` | `Int` | No | `@default(1)` | None | Snapshot of `User.sessionVersion`. |
| `ipAddress` | `String` | Yes | None | None | Client IP address. |
| `userAgent` | `String` | Yes | None | None | Browser/device user-agent string. |
| `expiresAt` | `DateTime` | No | None | None | Absolute expiration cutoff. |
| `lastActiveAt` | `DateTime` | No | `@default(now())` | None | Sliding activity timestamp (throttled). |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Session issuance timestamp. |

---

### 3. `AuthToken`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Token record ID. |
| `userId` | `String` | No | None | FK -> `User.id` (`onDelete: Cascade`) | Target user. |
| `purpose` | `AuthTokenPurpose` | No | None | None | `EMAIL_VERIFICATION` or `PASSWORD_RESET`.|
| `tokenHash` | `String` | No | `@unique` | None | SHA-256 digest of emailed token. |
| `expiresAt` | `DateTime` | No | None | None | Token expiry timestamp. |
| `usedAt` | `DateTime` | Yes | None | None | Token consumption timestamp. |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Issuance timestamp. |

---

### 4. `Pet`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Pet ID. |
| `ownerId` | `String` | No | None | FK -> `User.id` (`onDelete: Restrict`) | Pet owner. |
| `name` | `String` | No | None | None | Pet name. |
| `species` | `Species` | No | None | None | `DOG` or `CAT`. |
| `breed` | `String` | Yes | None | None | Breed description. |
| `weightKg` | `Decimal(4,1)`| Yes | None | None | Current weight in kg. |
| `careNotes` | `String` | Yes | None | None | Special handling/care instructions. |
| `archivedAt` | `DateTime` | Yes | None | None | Soft delete timestamp. |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Creation timestamp. |
| `updatedAt` | `DateTime` | No | `@updatedAt` | None | Modification timestamp. |
| *Relation: bookings* | `Booking[]` | Yes (1:N) | None | `onDelete: Restrict` | Bookings for this pet. |

---

### 5. `ServiceConfig`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `serviceType` | `ServiceType` | No | `@id` | PK (`GROOMING`, `DAYCARE`, `BOARDING`) | Target service. |
| `defaultCapacity`| `Int` | No | None | None | Base capacity per slot/day/night. |
| `slotTimes` | `String[]` | No | None | None | Grooming slot times (`["09:00","12:00"]`).|
| `opensAt` | `String` | No | `@default("08:00")` | None | Facility opening time. |
| `closesAt` | `String` | No | `@default("20:00")` | None | Facility closing time. |
| `updatedAt` | `DateTime` | No | `@updatedAt` | None | Modification timestamp. |

---

### 6. `PriceItem`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Price item ID. |
| `priceKey` | `String` | No | `@unique` | None | Key (e.g. `GROOMING:DOG:FULL:MEDIUM`). |
| `serviceType` | `ServiceType` | No | None | None | Associated service. |
| `species` | `Species` | Yes | None | None | Target species. |
| `groomingPackage`| `GroomingPackage`| Yes | None | None | `BASIC`, `FULL`, or `PREMIUM`. |
| `sizeTier` | `SizeTier` | Yes | None | None | `SMALL`, `MEDIUM`, or `LARGE`. |
| `amountKobo` | `Int` | No | None | None | Fee in integer kobo. |
| `isActive` | `Boolean` | No | `@default(true)` | None | Active catalog flag. |
| `updatedAt` | `DateTime` | No | `@updatedAt` | None | Modification timestamp. |

---

### 7. `Closure`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Closure ID. |
| `serviceType` | `ServiceType` | Yes | None | None | Affected service (null = all). |
| `startDate` | `DateTime` (`@db.Date`)| No | None | None | Blackout start date (Lagos). |
| `endDate` | `DateTime` (`@db.Date`)| No | None | None | Blackout end date (Lagos). |
| `message` | `String` | Yes | None | None | Public closure explanation. |
| `createdById` | `String` | No | None | FK -> `User.id` (`onDelete: Restrict`) | Manager who scheduled closure. |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Record timestamp. |

---

### 8. `CapacityUnit`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Capacity bucket ID. |
| `serviceType` | `ServiceType` | No | None | None | Associated service. |
| `serviceDate` | `DateTime` (`@db.Date`)| No | None | None | Calendar date. |
| `slotCode` | `String` | No | None | None | Time slot (`"09:00"`, `"DAY"`, `"NIGHT"`). |
| `capacity` | `Int` | No | None | None | Maximum available units. |
| `reserved` | `Int` | No | `@default(0)` | Check: `0 <= reserved <= capacity` | Currently allocated units. |
| *Relation: bookingUnits*| `BookingUnit[]`| Yes (1:N) | None | `onDelete: Restrict` | Allocations linked to this bucket. |

---

### 9. `Booking`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Booking record ID. |
| `reference` | `String` | No | `@unique` | None | Business reference (e.g. `GP-V5SRFM`). |
| `idempotencyKey`| `String` | No | None | Composite unique with `customerId` | Prevents duplicate creation. |
| `customerId` | `String` | No | None | FK -> `User.id` (`onDelete: Restrict`) | Pet owner. |
| `petId` | `String` | No | None | FK -> `Pet.id` (`onDelete: Restrict`) | Pet being cared for. |
| `serviceType` | `ServiceType` | No | None | None | `GROOMING`, `DAYCARE`, `BOARDING`. |
| `groomingPackage`| `GroomingPackage`| Yes | None | None | Package selected. |
| `slotCode` | `String` | Yes | None | None | Grooming slot. |
| `status` | `BookingStatus` | No | `@default(PENDING_PAYMENT)` | None | Booking status lifecycle. |
| `startDate` | `DateTime` (`@db.Date`)| No | None | None | First service date. |
| `endDate` | `DateTime` (`@db.Date`)| No | None | None | Last service date. |
| `quantity` | `Int` | No | None | None | Number of units/days/nights. |
| `petNameSnapshot`| `String` | No | None | None | Pet name snapshot at booking creation. |
| `petSpeciesSnapshot`| `Species` | No | None | None | Pet species snapshot. |
| `petWeightKgSnapshot`| `Decimal(4,1)`| Yes | None | None | Pet weight snapshot. |
| `sizeTierSnapshot`| `SizeTier` | Yes | None | None | Dog size tier snapshot. |
| `unitPriceKobo`| `Int` | No | None | None | Unit price charged in kobo. |
| `totalKobo` | `Int` | No | None | Check: `totalKobo = unitPrice * quantity` | Total booking price in kobo. |
| `currency` | `String` | No | `@default("NGN")` | None | Currency code (`NGN`). |
| `holdExpiresAt`| `DateTime` | Yes | None | None | 10-minute hold expiration boundary. |
| `confirmedAt` | `DateTime` | Yes | None | None | Payment confirmation timestamp. |
| `rescheduleCount`| `Int` | No | `@default(0)` | None | Counter of reschedules. |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Creation timestamp. |
| `updatedAt` | `DateTime` | No | `@updatedAt` | None | Modification timestamp. |
| *Relation: units* | `BookingUnit[]` | Yes (1:N) | None | `onDelete: Cascade` | Allocated capacity units. |
| *Relation: payments* | `Payment[]` | Yes (1:N) | None | `onDelete: Restrict` | Payment records. |

---

### 10. `BookingUnit`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Junction ID. |
| `bookingId` | `String` | No | None | FK -> `Booking.id` (`onDelete: Cascade`) | Target booking. |
| `capacityUnitId`| `String` | No | None | FK -> `CapacityUnit.id` (`onDelete: Restrict`)| Allocated capacity unit. |
| `releasedAt` | `DateTime` | Yes | None | None | Timestamp released on hold expiry. |

---

### 11. `Payment`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Unique payment record ID. |
| `bookingId` | `String` | No | None | FK -> `Booking.id` (`onDelete: Restrict`) | Associated booking. |
| `reference` | `String` | No | `@unique` | None | Primary payment reference (`PAY-GP-...`).|
| `amountKobo` | `Int` | No | None | Matches `Booking.totalKobo` | Total payable in integer kobo. |
| `currency` | `String` | No | `@default("NGN")` | None | Currency code (`NGN`). |
| `status` | `PaymentStatus` | No | `@default(INITIATED)` | None | Status: `INITIATED`, `SUCCEEDED`, `FAILED`, `ABANDONED`. |
| `settlementAttemptId`| `String`| Yes | `@unique` | FK -> `PaymentAttempt.id` (`onDelete: SetNull`) | Specific attempt that settled payment. |
| `channel` | `String` | Yes | None | None | Summary channel of successful settlement.|
| `paystackTransactionId`| `String`| Yes | None | None | Summary transaction ID of settlement. |
| `accessCode` | `String` | Yes | None | None | Latest gateway access code. |
| `gatewayResponse`| `String` | Yes | None | None | Gateway status message. |
| `verifySummary`| `Json` | Yes | None | None | Sanitized gateway verification payload. |
| `initiatedAt` | `DateTime` | No | `@default(now())` | None | Checkout start timestamp. |
| `paidAt` | `DateTime` | Yes | None | None | Gateway charge timestamp. |
| `verifiedAt` | `DateTime` | Yes | None | None | Server confirmation timestamp. |
| *Relation: attempts* | `PaymentAttempt[]`| Yes (1:N)| None | `onDelete: Restrict` | History of checkout attempts. |

---

### 12. `PaymentAttempt`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Attempt ID. |
| `paymentId` | `String` | No | None | FK -> `Payment.id` (`onDelete: Restrict`) | Parent payment. |
| `attemptNumber`| `Int` | No | `@default(1)` | Composite unique with `paymentId` | Sequential attempt counter. |
| `attemptReference`| `String`| No | `@unique` | None | Unique reference sent to Paystack. |
| `channel` | `String` | Yes | None | None | Channel attempted (`card`, `bank_transfer`).|
| `status` | `PaymentAttemptStatus`| No | `@default(INITIATED)` | None | Gateway status: `INITIATED`, `SUCCEEDED`, `FAILED`, `ABANDONED`. |
| `reconciliation`| `PaymentAttemptReconciliation`| No | `@default(UNRECONCILED)`| None | Lifecycle: `UNRECONCILED`, `APPLIED`, `DUPLICATE`, `UNAPPLIED`, `REFUND_PENDING`, `RECONCILED`. |
| `accountEmailSnapshot`| `String`| Yes | None | None | Customer account email at checkout launch. |
| `paystackTransactionId`| `String`| Yes | None | None | Paystack transaction ID for this attempt. |
| `accessCode` | `String` | Yes | None | None | Paystack access code for this modal. |
| `gatewayResponse`| `String` | Yes | None | None | Raw response message from Paystack. |
| `errorCode` | `String` | Yes | None | None | Decline error code (e.g. `insufficient_funds`).|
| `rawSummary` | `Json` | Yes | None | None | Sanitized gateway response JSON. |
| `ipAddress` | `String` | Yes | None | None | Customer IP address. |
| `initiatedAt` | `DateTime` | No | `@default(now())` | None | Attempt launch timestamp. |
| `completedAt` | `DateTime` | Yes | None | None | Terminal state timestamp. |

---

### 13. `WebhookEvent`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Webhook record ID. |
| `provider` | `String` | No | `@default("paystack")` | None | Gateway provider name. |
| `dedupeKey` | `String` | No | `@unique` | None | Deduplication key (`paystack:event:id`). |
| `eventType` | `String` | No | None | None | Webhook event name (`charge.success`). |
| `reference` | `String` | Yes | None | None | Transaction reference in payload. |
| `payloadSummary`| `Json` | No | None | None | Scrubbed JSON payload summary. |
| `status` | `WebhookStatus` | No | `@default(RECEIVED)` | None | Status: `RECEIVED`, `PROCESSED`, `IGNORED`, `FAILED`. |
| `error` | `String` | Yes | None | None | Error message on processing failure. |
| `receivedAt` | `DateTime` | No | `@default(now())` | None | Ingestion timestamp. |
| `processedAt` | `DateTime` | Yes | None | None | Processing completion timestamp. |

---

### 14. `KnowledgeDocument`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Document ID. |
| `slug` | `String` | No | `@unique` | None | Human-readable slug. |
| `title` | `String` | No | None | None | Document title. |
| `draftBody` | `String` | No | None | None | Working draft content. |
| `publishedBody`| `String` | Yes | None | None | Live published content. |
| `publishedVersion`| `Int` | No | `@default(0)` | None | Monotonically increasing version counter.|
| `publishedAt` | `DateTime` | Yes | None | None | Publish timestamp. |
| `publishedById`| `String` | Yes | None | FK -> `User.id` (`onDelete: SetNull`) | Publishing manager. |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Creation timestamp. |
| `updatedAt` | `DateTime` | No | `@updatedAt` | None | Modification timestamp. |
| *Relation: chunks* | `KnowledgeChunk[]`| Yes (1:N) | None | `onDelete: Cascade` | Vector chunks. |

---

### 15. `KnowledgeChunk`
| Field | Type | Nullable | Constraints & Defaults | Relations & Delete Behaviour | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | No | `@id @default(cuid())` | PK | Chunk ID. |
| `documentId` | `String` | No | None | FK -> `KnowledgeDocument.id` (`onDelete: Cascade`)| Parent document. |
| `version` | `Int` | No | None | None | Matches document version at generation. |
| `chunkIndex` | `Int` | No | None | None | Sequential zero-based chunk index. |
| `heading` | `String` | Yes | None | None | Section heading hierarchy. |
| `content` | `String` | No | None | None | Text content for LLM context. |
| `embedding` | `Unsupported("vector(1536)")`| No | Enforced in SQL | None | 1536-dimensional pgvector embedding. |
| `embeddingModel`| `String` | No | None | None | Model name (`text-embedding-3-small`). |
| `createdAt` | `DateTime` | No | `@default(now())` | None | Chunk generation timestamp. |

---

## 4. Complete Index Inventory

| Model | Index Target | Type | Query & Integrity Requirement Supported | Write Cost |
| :--- | :--- | :--- | :--- | :--- |
| `User` | `[email]` | `UNIQUE` | Fast lookup during sign-in; blocks duplicate registrations. | 1 write per signup. |
| `User` | `[customerId]` | `UNIQUE` | Customer ID sign-in lookup; guarantees collision-free customer IDs. | 1 write per signup. |
| `User` | `[role]` | B-Tree | Staff dashboard filtering (`WHERE role IN ('FRONT_DESK', 'MANAGER')`). | Low. |
| `Session` | `[sessionTokenHash]` | `UNIQUE` | Executed on every authenticated HTTP request in `requireUser`. | 1 write per login. |
| `Session` | `[userId]` | B-Tree | Multi-device session enumeration and "Sign out of all sessions". | Low. |
| `Session` | `[expiresAt]` | B-Tree | Background cleanup job deleting expired sessions (`WHERE expiresAt < NOW()`). | Low. |
| `AuthToken` | `[tokenHash]` | `UNIQUE` | Verification and password reset link resolution. | 1 write per dispatch. |
| `AuthToken` | `[userId, purpose]` | B-Tree | Finding pending tokens for an existing user. | Low. |
| `AuthToken` | `[expiresAt]` | B-Tree | Cleanup of expired auth tokens. | Low. |
| `Pet` | `[ownerId]` | B-Tree | Customer dashboard loading user's pet list. | 1 write per pet. |
| `PriceItem` | `[priceKey]` | `UNIQUE` | Fast catalog price calculation lookup. | Zero outside seeding. |
| `PriceItem` | `[serviceType]` | B-Tree | Loading all price items for a specific service. | Zero outside seeding. |
| `Closure` | `[startDate, endDate]` | B-Tree | Checking for blackout overlaps during date selection. | Low. |
| `CapacityUnit` | `[serviceDate]` | B-Tree | Fetching availability calendar for a month/week range. | 1 write per date seed. |
| `CapacityUnit` | `[serviceType, serviceDate, slotCode]` | `UNIQUE` | Guarantees exactly one capacity bucket per slot/day/service. | 1 write per date seed. |
| `Booking` | `[reference]` | `UNIQUE` | Customer & staff booking status lookups by reference. | 1 write per booking. |
| `Booking` | `[customerId, idempotencyKey]` | `UNIQUE` | Enforces client idempotency on booking creation. | 1 write per booking. |
| `Booking` | `[customerId, startDate]` | B-Tree | "My Bookings" screen ordered chronologically. | 1 write per booking. |
| `Booking` | `[status, holdExpiresAt]` | B-Tree | Inngest background job querying expired capacity holds. | Low. |
| `Booking` | `[startDate]` | B-Tree | Staff arrival roster by service date. | Low. |
| `BookingUnit` | `[capacityUnitId]` | B-Tree | Capacity calculation queries joining bookings. | Low. |
| `BookingUnit` | `[bookingId, capacityUnitId]` | `UNIQUE` | Prevents allocating the same capacity bucket twice to one booking. | Low. |
| `Payment` | `[reference]` | `UNIQUE` | Primary reference lookup from Paystack callbacks. | 1 write per checkout. |
| `Payment` | `[settlementAttemptId]` | `UNIQUE` | 1:1 subset link ensuring one settling attempt per payment. | Low. |
| `Payment` | `[bookingId]` | B-Tree | Locating payments for a given booking. | Low. |
| `Payment` | `[status, initiatedAt]` | B-Tree | Stale payment reconciliation job. | Low. |
| `PaymentAttempt`| `[attemptReference]` | `UNIQUE` | Webhook and callback resolution for a specific attempt. | 1 write per modal launch. |
| `PaymentAttempt`| `[paymentId, attemptNumber]` | `UNIQUE` | Enforces sequential attempt numbers; chronological audit drawer display. | Low. |
| `PaymentAttempt`| `[paystackTransactionId]` | B-Tree | Reconciliation queries matching Paystack numeric transaction IDs. | Low (sparse). |
| `PaymentAttempt`| `[paymentId, reconciliation]` | B-Tree | Manager "Needs Attention" query for duplicate/unapplied charges. | Low. |
| `WebhookEvent` | `[dedupeKey]` | `UNIQUE` | Webhook status-aware deduplication and replay protection. | 1 write per webhook. |
| `WebhookEvent` | `[receivedAt]` | B-Tree | Webhook log pruning and chronological debugging. | Low. |
| `KnowledgeDocument` | `[slug]` | `UNIQUE` | Resolving documentation articles by URL slug. | Zero outside publishing. |
| `KnowledgeChunk` | `[documentId, version, chunkIndex]` | `UNIQUE` | Guarantees idempotent vector insertion during re-embedding. | Zero outside publishing. |
| `KnowledgeChunk` | `[documentId, version]` | B-Tree | AI assistant pre-filtering chunks of the active published version. | Zero outside publishing. |

---

### Assumptions
- Customer account email at checkout launch is preserved as `accountEmailSnapshot` on `PaymentAttempt`. Retention duration is managed via operational business retention policies.
- The constraint that `settlementAttempt.paymentId === payment.id` is enforced atomically by application logic inside the database transaction.
- Vector column operations use raw SQL (`prisma.$queryRaw` / `prisma.$executeRaw`) as mandated by PRD Section 10.1 and `AGENTS.md`.
- No application files, database records, or migrations were modified during this read-only specification.