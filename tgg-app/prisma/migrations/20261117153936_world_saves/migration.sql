-- CreateTable
CREATE TABLE "TggPlayer" (
    "id" TEXT NOT NULL,
    "steamId" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TggPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggTelemetryEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggTelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggDelivery" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "playerId" TEXT,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TggDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggClan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggClan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggClanMember" (
    "clanId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggClanMember_pkey" PRIMARY KEY ("clanId","playerId")
);

-- CreateTable
CREATE TABLE "TggModerationAction" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggMetricSample" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "labels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggMetricSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggVaultAccount" (
    "id" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggVaultAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggWorldSave" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 2,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "bestRunMs" DOUBLE PRECISION,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "career" JSONB NOT NULL DEFAULT '{}',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TggWorldSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggWorldRun" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "totalMs" DOUBLE PRECISION NOT NULL,
    "legs" JSONB NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggWorldRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TggVaultLedger" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "fromAccount" TEXT NOT NULL,
    "toAccount" TEXT NOT NULL,
    "playerId" TEXT,
    "amount" BIGINT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TggVaultLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TggPlayer_steamId_key" ON "TggPlayer"("steamId");

-- CreateIndex
CREATE INDEX "TggTelemetryEvent_playerId_createdAt_idx" ON "TggTelemetryEvent"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "TggTelemetryEvent_eventType_createdAt_idx" ON "TggTelemetryEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TggDelivery_externalId_key" ON "TggDelivery"("externalId");

-- CreateIndex
CREATE INDEX "TggDelivery_playerId_createdAt_idx" ON "TggDelivery"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "TggDelivery_status_createdAt_idx" ON "TggDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TggClanMember_playerId_idx" ON "TggClanMember"("playerId");

-- CreateIndex
CREATE INDEX "TggModerationAction_playerId_createdAt_idx" ON "TggModerationAction"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "TggMetricSample_name_createdAt_idx" ON "TggMetricSample"("name", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TggWorldSave_playerId_key" ON "TggWorldSave"("playerId");

-- CreateIndex
CREATE INDEX "TggWorldSave_updatedAt_idx" ON "TggWorldSave"("updatedAt");

-- CreateIndex
CREATE INDEX "TggWorldRun_playerId_createdAt_idx" ON "TggWorldRun"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TggVaultLedger_transferId_key" ON "TggVaultLedger"("transferId");

-- CreateIndex
CREATE INDEX "TggVaultLedger_fromAccount_createdAt_idx" ON "TggVaultLedger"("fromAccount", "createdAt");

-- CreateIndex
CREATE INDEX "TggVaultLedger_toAccount_createdAt_idx" ON "TggVaultLedger"("toAccount", "createdAt");

-- AddForeignKey
ALTER TABLE "TggTelemetryEvent" ADD CONSTRAINT "TggTelemetryEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TggPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggDelivery" ADD CONSTRAINT "TggDelivery_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TggPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggClanMember" ADD CONSTRAINT "TggClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "TggClan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggClanMember" ADD CONSTRAINT "TggClanMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TggPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggWorldSave" ADD CONSTRAINT "TggWorldSave_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TggPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggWorldRun" ADD CONSTRAINT "TggWorldRun_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "TggWorldSave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggWorldRun" ADD CONSTRAINT "TggWorldRun_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TggPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggVaultLedger" ADD CONSTRAINT "TggVaultLedger_fromAccount_fkey" FOREIGN KEY ("fromAccount") REFERENCES "TggVaultAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggVaultLedger" ADD CONSTRAINT "TggVaultLedger_toAccount_fkey" FOREIGN KEY ("toAccount") REFERENCES "TggVaultAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TggVaultLedger" ADD CONSTRAINT "TggVaultLedger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TggPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
