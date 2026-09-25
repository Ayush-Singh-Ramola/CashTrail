import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, format, getDaysInMonth, subMonths } from "date-fns";
import type { Category } from "@/app/generated/prisma/client";
import { detectPatterns, type SpendingPattern } from "./patterns";

export interface ReportData {
  year: number;
  month: number;
  monthName: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  foodDeliveryTotal: number;
  dailySpend: Array<{ day: number; current: number; previous: number }>;
  recentTransactions: Array<{
    id: number;
    date: Date;
    merchantName: string;
    description: string;
    categoryName: string;
    categoryColor: string | null;
    amount: number;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
  }>;
  categoryBreakdown: Array<{
    categoryId: number;
    name: string;
    color: string | null;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
  biggestLeaks: Array<{
    name: string;
    amount: number;
    count: number;
  }>;
  smallPurchases: {
    count: number;
    total: number;
    percentage: number;
  };
  topMerchants: Array<{
    merchantId: number;
    name: string;
    amount: number;
    count: number;
  }>;
  expensiveTransactions: Array<{
    id: number;
    description: string;
    amount: number;
    date: Date;
    merchantName: string | null;
    categoryName: string | null;
  }>;
  patterns: SpendingPattern[];
  recurringPayments: SpendingPattern[];
  classificationBreakdown: Array<{ classification: string; amount: number; count: number }>;
  monthOverMonth: {
    previousMonthName: string;
    previousTotal: number;
    hasPreviousTransactions: boolean;
    change: number;
    changePercent: number;
    categoryChanges: Array<{ category: string; previousAmount: number; amount: number; change: number }>;
  };
  explanation: string;
}

export async function generateReport(userId: number, year: number, month: number): Promise<ReportData> {
  const selectedMonth = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const previousMonth = subMonths(selectedMonth, 1);
  const previousMonthStart = startOfMonth(previousMonth);
  const previousMonthEnd = endOfMonth(previousMonth);

  const [transactions, previousTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, transactionDate: { gte: monthStart, lte: monthEnd } },
      include: { category: true, merchant: true },
      orderBy: { transactionDate: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE", transactionDate: { gte: previousMonthStart, lte: previousMonthEnd } },
      include: { category: true },
    }),
  ]);

  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions.filter((t) => t.type === "EXPENSE");
  const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const foodDeliveryTotal = expenses
    .filter((transaction) => {
      const merchantName = transaction.merchant?.name?.toLowerCase() ?? "";
      return merchantName.includes("zomato") || merchantName.includes("swiggy");
    })
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const currentDays = Array.from({ length: getDaysInMonth(selectedMonth) }, () => 0);
  const previousDays = Array.from({ length: getDaysInMonth(previousMonth) }, () => 0);
  for (const transaction of expenses) currentDays[transaction.transactionDate.getDate() - 1] += Number(transaction.amount);
  for (const transaction of previousTransactions) previousDays[transaction.transactionDate.getDate() - 1] += Number(transaction.amount);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const chartDays = isCurrentMonth ? now.getDate() : currentDays.length;
  const dailySpend = Array.from({ length: chartDays }, (_, index) => ({
    day: index + 1,
    current: currentDays[index],
    previous: previousDays[index] ?? 0,
  }));
  const recentTransactions = transactions.slice(0, 8).map((transaction) => ({
    id: transaction.id,
    date: transaction.transactionDate,
    merchantName: transaction.merchant?.name || transaction.normalizedDesc || transaction.description || "Transaction",
    description: transaction.description || "",
    categoryName: transaction.category?.name || "Uncategorized",
    categoryColor: transaction.category?.color ?? null,
    amount: Number(transaction.amount),
    type: transaction.type,
  }));

  const categoryMap = new Map<number, { amount: number; count: number; category: Category | null }>();
  for (const t of expenses) {
    const key = t.categoryId || 0;
    const existing = categoryMap.get(key) || { amount: 0, count: 0, category: t.category };
    existing.amount += Number(t.amount);
    existing.count += 1;
    categoryMap.set(key, existing);
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      name: data.category?.name || "Uncategorized",
      color: data.category?.color ?? null,
      amount: data.amount,
      percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  const previousCategoryTotals = new Map<string, number>();
  for (const transaction of previousTransactions) {
    const name = transaction.category?.name || "Uncategorized";
    previousCategoryTotals.set(name, (previousCategoryTotals.get(name) ?? 0) + Number(transaction.amount));
  }
  const categoryChanges = Array.from(new Set([...categoryBreakdown.map((category) => category.name), ...previousCategoryTotals.keys()]))
    .map((category) => {
      const amount = categoryBreakdown.find((item) => item.name === category)?.amount ?? 0;
      const previousAmount = previousCategoryTotals.get(category) ?? 0;
      return { category, amount, previousAmount, change: amount - previousAmount };
    })
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change));

  const classificationMap = new Map<string, { amount: number; count: number }>();
  for (const transaction of expenses) {
    const classification = transaction.classification ?? "UNCLASSIFIED";
    const total = classificationMap.get(classification) ?? { amount: 0, count: 0 };
    total.amount += Number(transaction.amount);
    total.count += 1;
    classificationMap.set(classification, total);
  }
  const classificationBreakdown = Array.from(classificationMap, ([classification, totals]) => ({ classification, ...totals }))
    .sort((left, right) => right.amount - left.amount);

  const merchantMap = new Map<number, { amount: number; count: number; name: string }>();
  for (const t of expenses) {
    if (!t.merchantId) continue;
    const existing = merchantMap.get(t.merchantId) || { amount: 0, count: 0, name: t.merchant?.name || "Unknown" };
    existing.amount += Number(t.amount);
    existing.count += 1;
    merchantMap.set(t.merchantId, existing);
  }

  const topMerchants = Array.from(merchantMap.entries())
    .map(([merchantId, data]) => ({
      merchantId,
      name: data.name,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const biggestLeaks = [...merchantMap.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      amount: m.amount,
      count: m.count,
    }));

  const smallPurchaseThreshold = 200;
  const smallPurchases = expenses.filter((t) => Number(t.amount) < smallPurchaseThreshold);
  const smallTotal = smallPurchases.reduce((sum, t) => sum + Number(t.amount), 0);

  const expensiveTransactions = expenses
    .slice()
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      description: t.description || "",
      amount: Number(t.amount),
      date: t.transactionDate,
      merchantName: t.merchant?.name || null,
      categoryName: t.category?.name || null,
    }));

  const patterns = await detectPatterns(userId, year, month);
  const previousTotal = previousTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const recurringPayments = patterns.filter((pattern) => pattern.type === "recurring_payment");
  const change = totalExpense - previousTotal;
  const monthOverMonth = {
    previousMonthName: format(previousMonth, "MMMM yyyy"),
    previousTotal,
    hasPreviousTransactions: previousTransactions.length > 0,
    change,
    changePercent: previousTotal > 0 ? (change / previousTotal) * 100 : 0,
    categoryChanges,
  };
  const explanation = buildReportExplanation({
    monthName: format(monthStart, "MMMM yyyy"),
    totalIncome: income,
    totalExpense,
    netSavings: income - totalExpense,
    topCategory: categoryBreakdown[0] ?? null,
    monthOverMonth,
  });

  return {
    year,
    month,
    monthName: format(monthStart, "MMMM yyyy"),
    totalIncome: income,
    totalExpense,
    netSavings: income - totalExpense,
    foodDeliveryTotal,
    dailySpend,
    recentTransactions,
    categoryBreakdown,
    biggestLeaks,
    smallPurchases: {
      count: smallPurchases.length,
      total: smallTotal,
      percentage: totalExpense > 0 ? (smallTotal / totalExpense) * 100 : 0,
    },
    topMerchants,
    expensiveTransactions,
    patterns,
    recurringPayments,
    classificationBreakdown,
    monthOverMonth,
    explanation,
  };
}

function buildReportExplanation(input: {
  monthName: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  topCategory: { name: string; amount: number; percentage: number } | null;
  monthOverMonth: { previousMonthName: string; previousTotal: number; hasPreviousTransactions: boolean; change: number; changePercent: number };
}): string {
  const parts = [
    `${input.monthName}: ${input.totalIncome.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} received and ${input.totalExpense.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} spent.`,
    input.netSavings >= 0
      ? `${input.netSavings.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} remained after expenses.`
      : `Expenses exceeded income by ${Math.abs(input.netSavings).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}.`,
  ];
  if (input.topCategory) parts.push(`${input.topCategory.name} was the largest category at ${input.topCategory.percentage.toFixed(1)}% of spending.`);
  if (input.monthOverMonth.hasPreviousTransactions) {
    const direction = input.monthOverMonth.change > 0 ? "increased" : input.monthOverMonth.change < 0 ? "decreased" : "was unchanged";
    parts.push(`Spending ${direction} by ${Math.abs(input.monthOverMonth.change).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} (${Math.abs(input.monthOverMonth.changePercent).toFixed(1)}%) from ${input.monthOverMonth.previousMonthName}.`);
  }
  return parts.join(" ");
}

export async function getMonthlyComparison(
  userId: number,
  year1: number,
  month1: number,
  year2: number,
  month2: number
) {
  const [report1, report2] = await Promise.all([
    generateReport(userId, year1, month1),
    generateReport(userId, year2, month2),
  ]);

  const categoryMap1 = new Map(report1.categoryBreakdown.map((c) => [c.name, c.amount]));
  const categoryMap2 = new Map(report2.categoryBreakdown.map((c) => [c.name, c.amount]));

  const allCategories = new Set([...categoryMap1.keys(), ...categoryMap2.keys()]);

  const comparison = Array.from(allCategories).map((name) => {
    const amount1 = categoryMap1.get(name) || 0;
    const amount2 = categoryMap2.get(name) || 0;
    return {
      category: name,
      month1: amount1,
      month2: amount2,
      change: amount2 - amount1,
      changePercent: amount1 > 0 ? ((amount2 - amount1) / amount1) * 100 : 0,
    };
  });

  comparison.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return {
    month1: { year: year1, month: month1, name: report1.monthName, total: report1.totalExpense },
    month2: { year: year2, month: month2, name: report2.monthName, total: report2.totalExpense },
    comparison,
    biggestIncrease: comparison.filter((item) => item.change > 0).sort((a, b) => b.change - a.change)[0] || null,
    biggestDecrease: comparison.filter((item) => item.change < 0).sort((a, b) => a.change - b.change)[0] || null,
  };
}
