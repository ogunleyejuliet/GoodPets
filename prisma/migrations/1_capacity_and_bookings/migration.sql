-- Vector extension (see 10.2)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('GROOMING', 'DAYCARE', 'BOARDING');

-- CreateEnum
CREATE TYPE "GroomingPackage" AS ENUM ('BASIC', 'FULL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SizeTier" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'NEEDS_ATTENTION', 'EXPIRED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'SUCCEEDED', 'FAILED', 'ABANDONED', 'DUPLICATE_SUCCESS');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('ONLINE', 'STAFF_ASSISTED');

-- CreateEnum
CREATE TYPE "AuthStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "CollectorType" AS ENUM ('OWNER', 'AUTHORIZED_PERSON');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('NATIONAL_ID', 'DRIVERS_LICENCE', 'INTERNATIONAL_PASSPORT', 'VOTERS_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EmailTemplate" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'ACCOUNT_EXISTS_NOTICE', 'PASSWORD_CHANGED', 'BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'SERVICE_REMINDER', 'DAYCARE_PICKUP_REMINDER', 'PICKUP_CONFIRMATION', 'STAFF_AUTH_NOTICE', 'SUPPORT_REQUEST_STAFF');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "MessageOutcome" AS ENUM ('ANSWERED', 'REFUSED', 'FALLBACK', 'ERROR');

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "weightKg" DECIMAL(4,1),
    "careNotes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConfig" (
    "serviceType" "ServiceType" NOT NULL,
    "defaultCapacity" INTEGER NOT NULL,
    "slotTimes" TEXT[],
    "opensAt" TEXT NOT NULL DEFAULT '08:00',
    "closesAt" TEXT NOT NULL DEFAULT '20:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConfig_pkey" PRIMARY KEY ("serviceType")
);

-- CreateTable
CREATE TABLE "PriceItem" (
    "id" TEXT NOT NULL,
    "priceKey" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "species" "Species",
    "groomingPackage" "GroomingPackage",
    "sizeTier" "SizeTier",
    "amountKobo" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Closure" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType",
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "message" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Closure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityUnit" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "serviceDate" DATE NOT NULL,
    "slotCode" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CapacityUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "groomingPackage" "GroomingPackage",
    "slotCode" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "petNameSnapshot" TEXT NOT NULL,
    "petSpeciesSnapshot" "Species" NOT NULL,
    "petWeightKgSnapshot" DECIMAL(4,1),
    "sizeTierSnapshot" "SizeTier",
    "unitPriceKobo" INTEGER NOT NULL,
    "totalKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "holdExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingUnit" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "capacityUnitId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "BookingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "channel" TEXT,
    "paystackTransactionId" TEXT,
    "accessCode" TEXT,
    "gatewayResponse" TEXT,
    "verifySummary" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "reference" TEXT,
    "payloadSummary" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupAuthorization" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "method" "AuthMethod" NOT NULL,
    "verificationNote" TEXT,
    "status" "AuthStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revocationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "HandoverType" NOT NULL,
    "serviceDate" DATE NOT NULL,
    "staffId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectorType" "CollectorType",
    "authorizationId" TEXT,
    "idTypeChecked" "IdType",
    "latePickup" BOOLEAN NOT NULL DEFAULT false,
    "latePenaltyKobo" INTEGER,
    "note" TEXT,

    CONSTRAINT "HandoverEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "bookingId" TEXT,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "template" "EmailTemplate" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "userId" TEXT,
    "bookingId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "publishedBody" TEXT,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "embeddingModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "outcome" "MessageOutcome",
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceItem_priceKey_key" ON "PriceItem"("priceKey");

-- CreateIndex
CREATE INDEX "PriceItem_serviceType_idx" ON "PriceItem"("serviceType");

-- CreateIndex
CREATE INDEX "Closure_startDate_endDate_idx" ON "Closure"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CapacityUnit_serviceDate_idx" ON "CapacityUnit"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityUnit_serviceType_serviceDate_slotCode_key" ON "CapacityUnit"("serviceType", "serviceDate", "slotCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_customerId_startDate_idx" ON "Booking"("customerId", "startDate");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Booking_startDate_idx" ON "Booking"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_customerId_idempotencyKey_key" ON "Booking"("customerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BookingUnit_capacityUnitId_idx" ON "BookingUnit"("capacityUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingUnit_bookingId_capacityUnitId_key" ON "BookingUnit"("bookingId", "capacityUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_initiatedAt_idx" ON "Payment"("status", "initiatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "PickupAuthorization_bookingId_status_idx" ON "PickupAuthorization"("bookingId", "status");

-- CreateIndex
CREATE INDEX "HandoverEvent_serviceDate_idx" ON "HandoverEvent"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverEvent_bookingId_type_serviceDate_key" ON "HandoverEvent"("bookingId", "type", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_reference_key" ON "SupportRequest"("reference");

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_dedupeKey_key" ON "EmailLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_slug_key" ON "KnowledgeDocument"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_version_idx" ON "KnowledgeChunk"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_version_chunkIndex_key" ON "KnowledgeChunk"("documentId", "version", "chunkIndex");

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_expiresAt_idx" ON "Conversation"("expiresAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Closure" ADD CONSTRAINT "Closure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnit" ADD CONSTRAINT "BookingUnit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnit" ADD CONSTRAINT "BookingUnit_capacityUnitId_fkey" FOREIGN KEY ("capacityUnitId") REFERENCES "CapacityUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorization" ADD CONSTRAINT "PickupAuthorization_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorization" ADD CONSTRAINT "PickupAuthorization_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorization" ADD CONSTRAINT "PickupAuthorization_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverEvent" ADD CONSTRAINT "HandoverEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverEvent" ADD CONSTRAINT "HandoverEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverEvent" ADD CONSTRAINT "HandoverEvent_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PickupAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- PRD 10.1.1 Custom SQL Migration ----------

-- Vector column must always be present
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" SET NOT NULL;

-- Capacity can never be negative or exceeded (BR-011)
ALTER TABLE "CapacityUnit"
  ADD CONSTRAINT capacity_unit_reserved_within_capacity
  CHECK ("reserved" >= 0 AND "reserved" <= "capacity");

-- Totals must equal unit price times quantity
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_total_matches
  CHECK ("totalKobo" = "unitPriceKobo" * "quantity");

-- At most one successful payment per booking (BR-016)
CREATE UNIQUE INDEX payment_one_success_per_booking
  ON "Payment" ("bookingId") WHERE "status" = 'SUCCEEDED';

-- At most one open payment attempt per booking (FR-014)
CREATE UNIQUE INDEX payment_one_initiated_per_booking
  ON "Payment" ("bookingId") WHERE "status" = 'INITIATED';

-- Late pickup penalty only when flagged
ALTER TABLE "HandoverEvent"
  ADD CONSTRAINT handover_late_penalty_consistent
  CHECK (("latePickup" = false AND "latePenaltyKobo" IS NULL)
      OR ("latePickup" = true  AND "latePenaltyKobo" = 500000));

-- A check-out always records who collected and which ID type was seen (BR-026)
ALTER TABLE "HandoverEvent"
  ADD CONSTRAINT handover_checkout_has_collector
  CHECK ("type" <> 'CHECK_OUT' OR ("collectorType" IS NOT NULL AND "idTypeChecked" IS NOT NULL));

