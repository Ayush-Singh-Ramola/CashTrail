import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface SpendingPattern {
  type: "small_purchases" | "late_night" | "weekend" | "repeated_merchant" | "recurring_payment";
  label: string;
  description: string;
  count: number;
  totalAmount: number;
  percentageOfSpending: number;
  details?: Record<string, unknown>;
}

export interface PatternDetectionConfig {
  smallPurchaseThreshold: number;
  lateNightHour: number;
  repeatedMerchantMinCount: number;
}

export interface PatternTransaction {
  id: number;
  amount: number;
  transactionDate: Date;
  transactionTime: Date | null;
  merchantId: number | null;
  merchant?: { name: string } | null;
}

const DEFAULT_CONFIG: PatternDetectionConfig = {
  smallPurchaseThreshold: 200,
  lateNightHour: 22,
  repeatedMerchantMinCount: 3,
};

function validConfig(config?: Partial<PatternDetectionConfig>): PatternDetectionConfig {
  const supplied = config ?? {};
  return {
    smallPurchaseThreshold:
      Number.isFinite(supplied.smallPurchaseThreshold) && supplied.smallPurchaseThreshold! > 0
        ? supplied.smallPurchaseThreshold!
        : DEFAULT_CONFIG.smallPurchaseThreshold,
    lateNightHour:
      Number.isInteger(supplied.lateNightHour) && supplied.lateNightHour! >= 0 && supplied.lateNightHour! <= 23
        ? supplied.lateNightHour!
        : DEFAULT_CONFIG.lateNightHour,
    repeatedMerchantMinCount:
      Number.isInteger(supplied.repeatedMerchantMinCount) && supplied.repeatedMerchantMinCount! >= 2
        ? supplied.repeatedMerchantMinCount!
        : DEFAULT_CONFIG.repeatedMerchantMinCount,
  };
}

function amountOf(transaction: PatternTransaction): number {
  return Number(transaction.amount);
}

function percentage(amount: number, total: number): number {
  return total > 0 ? (amount / total) * 100 : 0;
}

function monthKey(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function circularDayDistance(left: number, right: number): number {
  const direct = Math.abs(left - right);
  return Math.min(direct, 31 - direct);
}

/** Pure deterministic calculation, also used by tests and report generation. */
export function detectPatternsFromTransactions(
  currentTransactions: PatternTransaction[],
  recentTransactions: PatternTransaction[] = currentTransactions,
  options?: Partial<PatternDetectionConfig>
): SpendingPattern[] {
  const config = validConfig(options);
  const expenses = currentTransactions.filter((transaction) => amountOf(transaction) > 0);
  if (expenses.length === 0) return [];

  const totalExpense = expenses.reduce((sum, transaction) => sum + amountOf(transaction), 0);
  const patterns: SpendingPattern[] = [];
  const smallPurchases = expenses.filter((transaction) => amountOf(transaction) < config.smallPurchaseThreshold);
  const smallTotal = smallPurchases.reduce((sum, transaction) => sum + amountOf(transaction), 0);

  if (smallPurchases.length > 0) {
    patterns.push({
      type: "small_purchases",
      label: "Small purchases",
      description: `${smallPurchases.length} transactions under ₹${config.smallPurchaseThreshold}`,
      count: smallPurchases.length,
      totalAmount: smallTotal,
      percentageOfSpending: percentage(smallTotal, totalExpense),
      details: { threshold: config.smallPurchaseThreshold },
    });
  }

  const lateNight = expenses.filter((transaction) =>
    transaction.transactionTime !== null && (
      transaction.transactionTime.getHours() > config.lateNightHour ||
      (transaction.transactionTime.getHours() === config.lateNightHour && transaction.transactionTime.getMinutes() > 0)
    )
  );
  if (lateNight.length > 0) {
    const total = lateNight.reduce((sum, transaction) => sum + amountOf(transaction), 0);
    patterns.push({
      type: "late_night",
      label: "Late-night spending",
      description: `${lateNight.length} transactions after ${config.lateNightHour}:00`,
      count: lateNight.length,
      totalAmount: total,
      percentageOfSpending: percentage(total, totalExpense),
      details: { fromHour: config.lateNightHour },
    });
  }

  const weekend = expenses.filter((transaction) => {
    const day = transaction.transactionDate.getDay();
    return day === 0 || day === 6;
  });
  if (weekend.length > 0) {
    const total = weekend.reduce((sum, transaction) => sum + amountOf(transaction), 0);
    patterns.push({
      type: "weekend",
      label: "Weekend spending",
      description: `${weekend.length} transactions on Saturday or Sunday`,
      count: weekend.length,
      totalAmount: total,
      percentageOfSpending: percentage(total, totalExpense),
    });
  }

  const merchantGroups = new Map<number, PatternTransaction[]>();
  for (const transaction of expenses) {
    if (transaction.merchantId === null) continue;
    const group = merchantGroups.get(transaction.merchantId) ?? [];
    group.push(transaction);
    merchantGroups.set(transaction.merchantId, group);
  }

  for (const [merchantId, transactions] of merchantGroups) {
    if (transactions.length < config.repeatedMerchantMinCount) continue;
    const total = transactions.reduce((sum, transaction) => sum + amountOf(transaction), 0);
    const merchantName = transactions[0].merchant?.name ?? "Unknown merchant";
    patterns.push({
      type: "repeated_merchant",
      label: "Frequent merchant",
      description: `${merchantName}: ${transactions.length} transactions this month`,
      count: transactions.length,
      totalAmount: total,
      percentageOfSpending: percentage(total, totalExpense),
      details: { merchantId, merchantName, minCount: config.repeatedMerchantMinCount },
    });
  }

  patterns.push(...detectRecurringPaymentPatterns(expenses, recentTransactions, totalExpense));
  return patterns;
}

function detectRecurringPaymentPatterns(
  currentTransactions: PatternTransaction[],
  recentTransactions: PatternTransaction[],
  totalExpense: number
): SpendingPattern[] {
  const currentByMerchant = new Map<number, PatternTransaction[]>();
  const historyByMerchant = new Map<number, Map<number, PatternTransaction[]>>();

  for (const transaction of recentTransactions) {
    if (transaction.merchantId === null || amountOf(transaction) <= 0) continue;
    const months = historyByMerchant.get(transaction.merchantId) ?? new Map<number, PatternTransaction[]>();
    const monthTransactions = months.get(monthKey(transaction.transactionDate)) ?? [];
    monthTransactions.push(transaction);
    months.set(monthKey(transaction.transactionDate), monthTransactions);
    historyByMerchant.set(transaction.merchantId, months);
  }
  for (const transaction of currentTransactions) {
    if (transaction.merchantId === null) continue;
    const transactions = currentByMerchant.get(transaction.merchantId) ?? [];
    transactions.push(transaction);
    currentByMerchant.set(transaction.merchantId, transactions);
  }

  const patterns: SpendingPattern[] = [];
  for (const [merchantId, current] of currentByMerchant) {
    const months = historyByMerchant.get(merchantId);
    if (!months || months.size < 2) continue;

    const currentAnchor = current[0];
    const anchorAmount = amountOf(currentAnchor);
    const anchorDay = currentAnchor.transactionDate.getDate();
    const matches: PatternTransaction[] = [];

    for (const monthlyTransactions of months.values()) {
      const candidate = monthlyTransactions
        .filter((transaction) => {
          const amount = amountOf(transaction);
          return amount > 0 && Math.abs(amount - anchorAmount) / anchorAmount <= 0.1 &&
            circularDayDistance(transaction.transactionDate.getDate(), anchorDay) <= 3;
        })
        .sort((left, right) => Math.abs(amountOf(left) - anchorAmount) - Math.abs(amountOf(right) - anchorAmount))[0];
      if (candidate) matches.push(candidate);
    }

    const matchedMonths = new Set(matches.map((transaction) => monthKey(transaction.transactionDate)));
    if (matchedMonths.size < 2 || !matchedMonths.has(monthKey(currentAnchor.transactionDate))) continue;

    const averageAmount = matches.reduce((sum, transaction) => sum + amountOf(transaction), 0) / matches.length;
    const currentTotal = current
      .filter((transaction) => Math.abs(amountOf(transaction) - averageAmount) / averageAmount <= 0.1)
      .reduce((sum, transaction) => sum + amountOf(transaction), 0);
    const merchantName = currentAnchor.merchant?.name ?? "Unknown merchant";
    const confidence = Math.min(0.95, 0.5 + matchedMonths.size * 0.15);

    patterns.push({
      type: "recurring_payment",
      label: "Likely recurring payment",
      description: `${merchantName} has similar charges near day ${anchorDay} in ${matchedMonths.size} recent months`,
      count: current.filter((transaction) => Math.abs(amountOf(transaction) - averageAmount) / averageAmount <= 0.1).length,
      totalAmount: currentTotal,
      percentageOfSpending: percentage(currentTotal, totalExpense),
      details: {
        merchantId,
        merchantName,
        averageAmount,
        dayOfMonth: anchorDay,
        monthsDetected: matchedMonths.size,
        confidence,
      },
    });
  }
  return patterns;
}

export async function detectPatterns(
  userId: number,
  year: number,
  month: number,
  config?: Partial<PatternDetectionConfig>
): Promise<SpendingPattern[]> {
  const configuredThreshold = Number(process.env.SMALL_PURCHASE_THRESHOLD);
  const effectiveConfig = {
    ...(Number.isFinite(configuredThreshold) && configuredThreshold > 0
      ? { smallPurchaseThreshold: configuredThreshold }
      : {}),
    ...config,
  };
  const selectedMonth = new Date(year, month - 1, 1);
  const currentStart = startOfMonth(selectedMonth);
  const currentEnd = endOfMonth(selectedMonth);
  const lookbackStart = startOfMonth(subMonths(selectedMonth, 2));

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: "EXPENSE",
      transactionDate: { gte: lookbackStart, lte: currentEnd },
    },
    include: { merchant: { select: { name: true } } },
    orderBy: { transactionDate: "asc" },
  });

  const transactions: PatternTransaction[] = rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    transactionDate: row.transactionDate,
    transactionTime: row.transactionTime,
    merchantId: row.merchantId,
    merchant: row.merchant,
  }));
  const current = transactions.filter((transaction) =>
    transaction.transactionDate >= currentStart && transaction.transactionDate <= currentEnd
  );

  return detectPatternsFromTransactions(current, transactions, effectiveConfig);
}

export async function getPatternsForReport(
  userId: number,
  year: number,
  month: number,
  config?: Partial<PatternDetectionConfig>
): Promise<SpendingPattern[]> {
  return detectPatterns(userId, year, month, config);
}
