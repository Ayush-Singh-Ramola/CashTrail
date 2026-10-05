ALTER TABLE "Transaction" ADD COLUMN "sourceTransactionId" TEXT;

CREATE INDEX "Transaction_userId_sourceTransactionId_idx"
ON "Transaction"("userId", "sourceTransactionId");
