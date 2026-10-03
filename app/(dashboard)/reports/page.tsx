import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { excludeDuplicateImports, getDuplicateImportIds } from "@/lib/transactions/import-deduplication";

export default async function ReportsIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const duplicateImportIds = await getDuplicateImportIds(session.id);
  const latestTransaction = await prisma.transaction.findFirst({
    where: excludeDuplicateImports({ userId: session.id, transactionDate: { lte: now } }, duplicateImportIds),
    orderBy: { transactionDate: "desc" },
    select: { transactionDate: true },
  });
  const reportDate = latestTransaction?.transactionDate ?? now;

  redirect(`/reports/${reportDate.getFullYear()}/${reportDate.getMonth() + 1}`);
}
