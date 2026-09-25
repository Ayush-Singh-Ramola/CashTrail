import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const income = importRecord.transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const spent = importRecord.transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return NextResponse.json({
    id: importRecord.id,
    fileName: importRecord.fileName,
    status: importRecord.status,
    transactionCount: importRecord.transactionCount,
    income,
    spent,
    transactions: importRecord.transactions,
  });
}