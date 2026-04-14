-- AlterTable
ALTER TABLE "User"
ADD COLUMN "discordUserId" TEXT;

-- AlterTable
ALTER TABLE "ActiveConversationState"
ADD COLUMN "questionDiscordMessageId" TEXT,
ADD COLUMN "questionDiscordMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "answerDiscordMessageId" TEXT,
ADD COLUMN "answerDiscordMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "DiscordApiCallKind" AS ENUM ('PUSH', 'REPLY', 'PROFILE');

-- CreateEnum
CREATE TYPE "DiscordApiCallStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "DiscordApiCallLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "itemId" INTEGER,
    "kind" "DiscordApiCallKind" NOT NULL,
    "status" "DiscordApiCallStatus" NOT NULL,
    "targetDiscordUserId" TEXT,
    "channelId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveConversationState_questionDiscordMessageId_key" ON "ActiveConversationState"("questionDiscordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveConversationState_answerDiscordMessageId_key" ON "ActiveConversationState"("answerDiscordMessageId");

-- CreateIndex
CREATE INDEX "DiscordApiCallLog_createdAt_idx" ON "DiscordApiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "DiscordApiCallLog_kind_createdAt_idx" ON "DiscordApiCallLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "DiscordApiCallLog_status_createdAt_idx" ON "DiscordApiCallLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DiscordApiCallLog_userId_createdAt_idx" ON "DiscordApiCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscordApiCallLog_itemId_createdAt_idx" ON "DiscordApiCallLog"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscordApiCallLog" ADD CONSTRAINT "DiscordApiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordApiCallLog" ADD CONSTRAINT "DiscordApiCallLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductStudyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
