DROP INDEX "Import_userId_contentHash_key";
CREATE INDEX "Import_userId_contentHash_idx" ON "Import"("userId", "contentHash");
