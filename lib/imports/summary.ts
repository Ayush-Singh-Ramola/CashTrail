export type ImportSummaryTransaction = {
  amount: number | string | { toNumber(): number };
  type: "INCOME" | "EXPENSE" | "TRANSFER";
};

export function summarizeImportTransactions(transactions: readonly ImportSummaryTransaction[]) {
  return transactions.reduce(
    (summary, transaction) => {
      const amount = typeof transaction.amount === "object"
        ? transaction.amount.toNumber()
        : Number(transaction.amount);

      if (transaction.type === "EXPENSE") {
        summary.debitCount += 1;
        summary.spent += amount;
      } else if (transaction.type === "INCOME") {
        summary.creditCount += 1;
        summary.received += amount;
      }

      return summary;
    },
    { transactionCount: transactions.length, debitCount: 0, creditCount: 0, spent: 0, received: 0 },
  );
}
