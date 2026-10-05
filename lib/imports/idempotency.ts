import type { Prisma } from "@/app/generated/prisma/client";

export async function createImportIfAbsent(
  tx: Prisma.TransactionClient,
  input: { userId: number; fileName: string; fileType: string; contentHash: string },
) {
  await tx.$queryRaw`
    WITH lock_result AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(${input.userId}, hashtext(${input.contentHash}))
    )
    SELECT true AS locked FROM lock_result
  `;

  const existingImport = await tx.import.findFirst({
    where: { userId: input.userId, contentHash: input.contentHash, status: { in: ["COMPLETED", "PROCESSING"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, transactionCount: true, status: true },
  });

  if (existingImport) return { existingImport, importRecord: null };

  const importRecord = await tx.import.create({
    data: {
      userId: input.userId,
      fileName: input.fileName,
      fileType: input.fileType,
      contentHash: input.contentHash,
      status: "PROCESSING",
    },
  });

  return { existingImport: null, importRecord };
}
