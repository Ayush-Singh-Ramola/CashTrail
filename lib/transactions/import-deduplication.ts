import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDuplicateImportIds(userId: number): Promise<number[]> {
  const imports = await prisma.import.findMany({
    where: { userId, status: "COMPLETED", contentHash: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, contentHash: true },
  });

  const seenHashes = new Set<string>();
  const duplicateIds: number[] = [];
  for (const importRecord of imports) {
    const hash = importRecord.contentHash;
    if (!hash) continue;
    if (seenHashes.has(hash)) duplicateIds.push(importRecord.id);
    else seenHashes.add(hash);
  }

  return duplicateIds;
}

export async function getDuplicateTransactionIds(userId: number): Promise<number[]> {
  const duplicateRows = await prisma.$queryRaw<Array<{ id: number }>>`
    WITH normalized_transactions AS (
      SELECT
        transaction_row."id",
        transaction_row."userId" AS user_id,
        transaction_row."importId" AS import_id,
        transaction_row."type" AS transaction_type,
        transaction_row."amount",
        transaction_row."transactionDate" AS transaction_date,
        NULLIF(upper(regexp_replace(btrim(transaction_row."sourceTransactionId"), '[[:space:]]+', '', 'g')), '') AS source_reference,
        COALESCE(
          NULLIF(lower(regexp_replace(btrim(transaction_row."description"), '[[:space:]]+', ' ', 'g')), ''),
          NULLIF(lower(btrim(transaction_row."normalizedDesc")), ''),
          ''
        ) AS transaction_description,
        import_record."createdAt" AS import_created_at,
        CASE
          WHEN lower(COALESCE(transaction_row."description", '')) LIKE 'received from %'
            OR lower(COALESCE(transaction_row."description", '')) LIKE '%cashback received%'
            OR lower(COALESCE(transaction_row."description", '')) LIKE '%refund from%'
            OR lower(COALESCE(transaction_row."description", '')) LIKE '%interest credited%'
            OR lower(COALESCE(transaction_row."description", '')) LIKE '%salary%'
          THEN 'INCOME'
          ELSE transaction_row."type"::text
        END AS expected_type
      FROM "Transaction" AS transaction_row
      INNER JOIN "Import" AS import_record ON import_record."id" = transaction_row."importId"
      WHERE transaction_row."userId" = ${userId}
        AND transaction_row."importId" IS NOT NULL
        AND import_record."status"::text = 'COMPLETED'
    ), keyed_transactions AS (
      SELECT
        id,
        user_id,
        import_id,
        transaction_type,
        amount,
        transaction_date,
        transaction_description,
        import_created_at,
        CASE
          WHEN source_reference IS NOT NULL THEN 'ref:' || source_reference
          ELSE concat_ws('|', 'fallback', expected_type, amount::text, date_trunc('day', transaction_date)::text, transaction_description)
        END AS transaction_key,
        CASE WHEN transaction_type::text = expected_type THEN 0 ELSE 1 END AS classification_rank
      FROM normalized_transactions
    ), source_occurrences AS (
      SELECT
        *,
        row_number() OVER (
          PARTITION BY user_id, import_id, transaction_key
          ORDER BY id
        ) AS source_occurrence
      FROM keyed_transactions
    ), ranked_copies AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY user_id, transaction_key, source_occurrence
          ORDER BY classification_rank, import_created_at DESC, import_id DESC, id DESC
        ) AS import_rank
      FROM source_occurrences
    )
    SELECT id FROM ranked_copies WHERE import_rank > 1
  `;

  return duplicateRows.map(({ id }) => Number(id));
}

export function excludeDuplicateImports(
  where: Prisma.TransactionWhereInput,
  duplicateImportIds: number[],
): Prisma.TransactionWhereInput {
  if (duplicateImportIds.length === 0) return where;

  return {
    AND: [
      where,
      {
        OR: [
          { importId: null },
          { importId: { notIn: duplicateImportIds } },
        ],
      },
    ],
  };
}

export function excludeDuplicateTransactions(
  where: Prisma.TransactionWhereInput,
  duplicateTransactionIds: number[],
  duplicateImportIds: number[] = [],
): Prisma.TransactionWhereInput {
  const canonicalImports = excludeDuplicateImports(where, duplicateImportIds);
  if (duplicateTransactionIds.length === 0) return canonicalImports;

  return {
    AND: [canonicalImports, { id: { notIn: duplicateTransactionIds } }],
  };
}
