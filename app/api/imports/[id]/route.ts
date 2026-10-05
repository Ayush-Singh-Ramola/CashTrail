import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeImportTransactions } from "@/lib/imports/summary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const importRecord = await prisma.import.findFirst({
    where: { id: parseInt(id), userId: session.id },
    include: {
      transactions: {
        include: { category: true, merchant: true },
        orderBy: { transactionDate: "desc" },
      },
    },
  });

  if (!importRecord) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const totals = summarizeImportTransactions(importRecord.transactions);

  return NextResponse.json({
    id: importRecord.id,
    fileName: importRecord.fileName,
    status: importRecord.status,
    transactionCount: totals.transactionCount,
    debitCount: totals.debitCount,
    creditCount: totals.creditCount,
    income: totals.received,
    spent: totals.spent,
    transactions: importRecord.transactions,
  });
}
