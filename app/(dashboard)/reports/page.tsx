import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { excludeDuplicateTransactions, getDuplicateImportIds, getDuplicateTransactionIds } from "@/lib/transactions/import-deduplication";

export default async function ReportsIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const [duplicateImportIds, duplicateTransactionIds] = await Promise.all([
    getDuplicateImportIds(session.id),
    getDuplicateTransactionIds(session.id),
  ]);
  const latestTransaction = await prisma.transaction.findFirst({
    where: excludeDuplicateTransactions(
      { userId: session.id, transactionDate: { lte: now } },
      duplicateTransactionIds,
      duplicateImportIds,
    ),
    orderBy: { transactionDate: "desc" },
    select: { transactionDate: true },
  });
  const reportDate = latestTransaction?.transactionDate ?? now;

  redirect(`/reports/${reportDate.getFullYear()}/${reportDate.getMonth() + 1}`);
}
