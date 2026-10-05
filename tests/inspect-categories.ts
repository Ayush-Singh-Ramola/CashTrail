import { prisma } from "../lib/prisma";
import { getDuplicateImportIds, getDuplicateTransactionIds, excludeDuplicateTransactions } from "../lib/transactions/import-deduplication";
import { startOfMonth, endOfMonth } from "date-fns";

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) return;
  const dupImports = await getDuplicateImportIds(user.id);
  const dupTxns = await getDuplicateTransactionIds(user.id);
  const currentMonthStart = startOfMonth(new Date(2026, 8, 25));
  const currentMonthEnd = endOfMonth(new Date(2026, 8, 25));

  const txns = await prisma.transaction.findMany({
    where: excludeDuplicateTransactions({
      userId: user.id,
      transactionDate: { gte: currentMonthStart, lte: currentMonthEnd },
      type: "EXPENSE",
    }, dupTxns, dupImports),
    include: { category: true, merchant: true },
  });

  const catMap = new Map<string, number>();
  for (const t of txns) {
    const name = t.category?.name || "Uncategorized";
    catMap.set(name, (catMap.get(name) || 0) + Number(t.amount));
  }
  console.log("Categories breakdown:", Object.fromEntries(catMap));

  // Check what categories are in the latest import (Import 24 or Import 14)
  const txns14 = await prisma.transaction.findMany({
    where: { importId: 14, type: "EXPENSE" },
    include: { category: true },
  });
  const cat14 = new Map<string, number>();
  for (const t of txns14) {
    const name = t.category?.name || "Uncategorized";
    cat14.set(name, (cat14.get(name) || 0) + Number(t.amount));
  }
  console.log("Import 14 categories:", Object.fromEntries(cat14));

  const txns24 = await prisma.transaction.findMany({
    where: { importId: 24, type: "EXPENSE" },
    include: { category: true },
  });
  const cat24 = new Map<string, number>();
  for (const t of txns24) {
    const name = t.category?.name || "Uncategorized";
    cat24.set(name, (cat24.get(name) || 0) + Number(t.amount));
  }
  console.log("Import 24 categories:", Object.fromEntries(cat24));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
