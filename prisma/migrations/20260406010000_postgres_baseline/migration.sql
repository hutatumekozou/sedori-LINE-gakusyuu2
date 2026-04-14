-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'QUESTION_SENT', 'ANSWER_SHOWN', 'CORRECT', 'INCORRECT');

-- CreateEnum
CREATE TYPE "ReviewActionType" AS ENUM ('SENT', 'ANSWER_SHOWN', 'GREAT_CORRECT', 'CORRECT', 'INCORRECT');

-- CreateEnum
CREATE TYPE "ConversationStateType" AS ENUM ('QUESTION_SENT', 'ANSWER_SHOWN');

-- CreateEnum
CREATE TYPE "ProductStudyImageKind" AS ENUM ('QUESTION', 'ANSWER');

-- CreateEnum
CREATE TYPE "GeminiApiCallStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "LineApiCallKind" AS ENUM ('PUSH', 'REPLY', 'PROFILE');

-- CreateEnum
CREATE TYPE "LineApiCallStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "lineUserId" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStudyItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "autoSendEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "productName" TEXT,
    "brandName" TEXT,
    "category" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "memo" TEXT,
    "firstScheduledAt" TIMESTAMP(3) NOT NULL,
    "nextScheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStudyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStudyImage" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "kind" "ProductStudyImageKind" NOT NULL DEFAULT 'QUESTION',
    "imagePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStudyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "actionType" "ReviewActionType" NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveConversationState" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "state" "ConversationStateType" NOT NULL,
    "questionLineMessageId" TEXT,
    "answerLineMessageId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeminiApiCallLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "status" "GeminiApiCallStatus" NOT NULL,
    "model" TEXT NOT NULL,
    "promptLength" INTEGER NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "responseLength" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeminiApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineApiCallLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "itemId" INTEGER,
    "kind" "LineApiCallKind" NOT NULL,
    "status" "LineApiCallStatus" NOT NULL,
    "targetLineUserId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedBillableCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStudyItem_questionNumber_key" ON "ProductStudyItem"("questionNumber");

-- CreateIndex
CREATE INDEX "ProductStudyItem_nextScheduledAt_idx" ON "ProductStudyItem"("nextScheduledAt");

-- CreateIndex
CREATE INDEX "ProductStudyItem_status_idx" ON "ProductStudyItem"("status");

-- CreateIndex
CREATE INDEX "ProductStudyItem_userId_idx" ON "ProductStudyItem"("userId");

-- CreateIndex
CREATE INDEX "ProductStudyImage_itemId_idx" ON "ProductStudyImage"("itemId");

-- CreateIndex
CREATE INDEX "ReviewLog_itemId_actionAt_idx" ON "ReviewLog"("itemId", "actionAt");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_actionAt_idx" ON "ReviewLog"("userId", "actionAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveConversationState_questionLineMessageId_key" ON "ActiveConversationState"("questionLineMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveConversationState_answerLineMessageId_key" ON "ActiveConversationState"("answerLineMessageId");

-- CreateIndex
CREATE INDEX "ActiveConversationState_itemId_idx" ON "ActiveConversationState"("itemId");

-- CreateIndex
CREATE INDEX "ActiveConversationState_userId_idx" ON "ActiveConversationState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveConversationState_userId_itemId_key" ON "ActiveConversationState"("userId", "itemId");

-- CreateIndex
CREATE INDEX "GeminiApiCallLog_createdAt_idx" ON "GeminiApiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "GeminiApiCallLog_status_createdAt_idx" ON "GeminiApiCallLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GeminiApiCallLog_userId_createdAt_idx" ON "GeminiApiCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LineApiCallLog_createdAt_idx" ON "LineApiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "LineApiCallLog_kind_createdAt_idx" ON "LineApiCallLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "LineApiCallLog_status_createdAt_idx" ON "LineApiCallLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LineApiCallLog_userId_createdAt_idx" ON "LineApiCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LineApiCallLog_itemId_createdAt_idx" ON "LineApiCallLog"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductStudyItem" ADD CONSTRAINT "ProductStudyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStudyImage" ADD CONSTRAINT "ProductStudyImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductStudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductStudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveConversationState" ADD CONSTRAINT "ActiveConversationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveConversationState" ADD CONSTRAINT "ActiveConversationState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductStudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeminiApiCallLog" ADD CONSTRAINT "GeminiApiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineApiCallLog" ADD CONSTRAINT "LineApiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineApiCallLog" ADD CONSTRAINT "LineApiCallLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductStudyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
