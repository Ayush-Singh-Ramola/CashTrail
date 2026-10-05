import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { CSSProperties } from "react";
import type { Prisma } from "@/app/generated/prisma/client";
import { DashboardIcon } from "@/components/dashboard-icon";
import { excludeDuplicateTransactions, getDuplicateImportIds, getDuplicateTransactionIds } from "@/lib/transactions/import-deduplication";
import styles from "./dashboard.module.css";

const chartPalette = ["#89df4b", "#3987f4", "#9e72ef", "#f39646", "#eb6277", "#8293a9"];

interface DashboardData {
  currentTotal: number;
  lastTotal: number;
  changePercent: number;
  sortedCategories: { name: string; amount: number; color: string }[];
  merchantData: { name: string; amount: number; count: number }[];
  smallPurchases: number;
  smallTotal: number;
  smallPercent: number;
  foodDeliveryTotal: number;
  transactionCount: number;
  recentTransactions: {
    id: number;
    date: Date;
    merchant: string;
    category: string;
    categoryColor: string;
    amount: number;
  }[];
  dailySpend: { day: number; current: number; previous: number }[];
}

function getCategoryColor(color: string | null | undefined, index: number) {
  return color && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)
    ? color
    : chartPalette[index % chartPalette.length];
}

async function getDashboardData(
  userId: number,
  periodDate: Date,
  duplicateImportIds: number[],
  duplicateTransactionIds: number[],
  requestedImportId?: number,
): Promise<DashboardData> {
  const currentMonthStart = startOfMonth(periodDate);
  const currentMonthEnd = endOfMonth(periodDate);
  const previousMonth = subMonths(periodDate, 1);
  const lastMonthStart = startOfMonth(previousMonth);
  const lastMonthEnd = endOfMonth(previousMonth);

  const currentWhere: Prisma.TransactionWhereInput = requestedImportId
    ? {
        userId,
        importId: requestedImportId,
        type: "EXPENSE",
      }
    : excludeDuplicateTransactions({
        userId,
        transactionDate: { gte: currentMonthStart, lte: currentMonthEnd },
        type: "EXPENSE",
      }, duplicateTransactionIds, duplicateImportIds);

  const previousWhere: Prisma.TransactionWhereInput = requestedImportId
    ? {
        userId,
        importId: requestedImportId,
        transactionDate: { gte: lastMonthStart, lte: lastMonthEnd },
        type: "EXPENSE",
      }
    : excludeDuplicateTransactions({
        userId,
        transactionDate: { gte: lastMonthStart, lte: lastMonthEnd },
        type: "EXPENSE",
      }, duplicateTransactionIds, duplicateImportIds);

  const [currentMonthTxns, lastMonthTxns, topMerchants] = await Promise.all([
    prisma.transaction.findMany({
      where: currentWhere,
      include: { category: true, merchant: true },
      orderBy: { transactionDate: "desc" },
    }),
    prisma.transaction.findMany({
      where: previousWhere,
      include: { category: true },
    }),
    prisma.transaction.groupBy({
      by: ["merchantId"],
      where: {
        ...currentWhere,
        merchantId: { not: null },
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
  ]);

  const currentTotal = currentMonthTxns.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const lastTotal = lastMonthTxns.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const changePercent = lastTotal > 0 ? ((currentTotal - lastTotal) / lastTotal) * 100 : 0;

  const categoryTotals = currentMonthTxns.reduce<Record<string, { amount: number; color: string | null }>>(
    (totals, transaction) => {
      const name = transaction.category?.name || "Uncategorized";
      const entry = totals[name] ?? { amount: 0, color: transaction.category?.color ?? null };
      entry.amount += Number(transaction.amount);
      totals[name] = entry;
      return totals;
    },
    {},
  );

  const allCategories = Object.entries(categoryTotals)
    .sort(([, first], [, second]) => second.amount - first.amount)
    .map(([name, value], index) => ({
      name,
      amount: value.amount,
      color: getCategoryColor(value.color, index),
    }));
  const sortedCategories = allCategories.length > 6
    ? [
        ...allCategories.slice(0, 5),
        {
          name: "Other",
          amount: allCategories.slice(5).reduce((sum, category) => sum + category.amount, 0),
          color: chartPalette[5],
        },
      ]
    : allCategories;

  const merchantIds = topMerchants
    .map((merchant) => merchant.merchantId)
    .filter((id): id is number => id !== null);
  const merchants = merchantIds.length > 0
    ? await prisma.merchant.findMany({ where: { id: { in: merchantIds } } })
    : [];
  const merchantMap = new Map(merchants.map((merchant) => [merchant.id, merchant.name]));
  const merchantData = topMerchants.map((merchant) => ({
    name: (merchant.merchantId !== null ? merchantMap.get(merchant.merchantId) : undefined) || "Unknown",
    amount: Number(merchant._sum.amount ?? 0),
    count: merchant._count.id,
  }));

  const smallPurchases = currentMonthTxns.filter((transaction) => Number(transaction.amount) < 200);
  const smallTotal = smallPurchases.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const smallPercent = currentTotal > 0 ? (smallTotal / currentTotal) * 100 : 0;
  const foodDeliveryTotal = currentMonthTxns
    .filter((transaction) => {
      const merchantName = (transaction.merchant?.name || transaction.normalizedDesc || transaction.description || "").toLowerCase();
      return merchantName.includes("zomato") || merchantName.includes("swiggy");
    })
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const recentTransactions = currentMonthTxns.slice(0, 8).map((transaction) => ({
    id: transaction.id,
    date: transaction.transactionDate,
    merchant: transaction.merchant?.name || transaction.normalizedDesc || transaction.description || "Transaction",
    category: transaction.category?.name || "Uncategorized",
    categoryColor: getCategoryColor(transaction.category?.color, 0),
    amount: Number(transaction.amount),
  }));

  const primaryDate = currentMonthTxns[0]?.transactionDate || periodDate;
  const daysInMonth = getDaysInMonth(primaryDate);
  const currentByDay = Array.from({ length: daysInMonth }, () => 0);
  const previousByDay = Array.from({ length: daysInMonth }, () => 0);
  for (const transaction of currentMonthTxns) {
    const day = transaction.transactionDate.getDate();
    if (day >= 1 && day <= daysInMonth) {
      currentByDay[day - 1] += Number(transaction.amount);
    }
  }
  for (const transaction of lastMonthTxns) {
    const day = transaction.transactionDate.getDate();
    if (day >= 1 && day <= daysInMonth) {
      previousByDay[day - 1] += Number(transaction.amount);
    }
  }
  const isCurrentCalendarMonth = new Date().getFullYear() === periodDate.getFullYear() && new Date().getMonth() === periodDate.getMonth();
  const visibleDays = isCurrentCalendarMonth ? Math.min(new Date().getDate(), daysInMonth) : daysInMonth;
  const dailySpend = Array.from({ length: Math.max(1, visibleDays) }, (_, index) => ({
    day: index + 1,
    current: currentByDay[index] ?? 0,
    previous: previousByDay[index] ?? 0,
  }));

  return {
    currentTotal,
    lastTotal,
    changePercent,
    sortedCategories,
    merchantData,
    smallPurchases: smallPurchases.length,
    smallTotal,
    smallPercent,
    foodDeliveryTotal,
    transactionCount: currentMonthTxns.length,
    recentTransactions,
    dailySpend,
  };
}

function money(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function chartY(amount: number, maximum: number) {
  return 211 - (amount / maximum) * 169;
}

function createLinePath(values: number[], maximum: number, width: number) {
  const denominator = Math.max(values.length - 1, 1);
  return values.map((value, index) => {
    const x = 48 + (index / denominator) * width;
    const y = chartY(value, maximum);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function createAreaPath(values: number[], maximum: number, width: number) {
  if (values.length === 0) return "";
  const denominator = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = 48 + (index / denominator) * width;
    return `${x.toFixed(1)},${chartY(value, maximum).toFixed(1)}`;
  });
  return `M${points[0]} L${points.slice(1).join(" L")} L${(48 + width).toFixed(1)},211 L48,211 Z`;
}

function SpendingChart({ data, monthName, monthAbbreviation, previousMonthName }: {
  data: DashboardData["dailySpend"];
  monthName: string;
  monthAbbreviation: string;
  previousMonthName: string;
}) {
  const maximumValue = Math.max(0, ...data.flatMap((item) => [item.current, item.previous]));
  const maximum = Math.max(500, Math.ceil(maximumValue / 500) * 500);
  const chartWidth = 652;
  const currentValues = data.map((item) => item.current);
  const previousValues = data.map((item) => item.previous);
  const currentPath = createLinePath(currentValues, maximum, chartWidth);
  const previousPath = createLinePath(previousValues, maximum, chartWidth);
  const areaPath = createAreaPath(currentValues, maximum, chartWidth);
  const tickDays = [...new Set([1, 5, 10, 15, 20, 25, data.length].filter((day) => day <= data.length))];

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartLegend}>
        <span><i className={styles.currentDot} />{monthName}</span>
        <span><i className={styles.previousDot} />{previousMonthName}</span>
      </div>
      <svg className={styles.chart} viewBox="0 0 720 260" role="img" aria-label={`Daily spending compared with ${previousMonthName}`}>
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8de34c" stopOpacity=".22" />
            <stop offset="100%" stopColor="#8de34c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = 211 - step * 169;
          const value = maximum * step;
          return (
            <g key={step}>
              <line x1="48" x2="700" y1={y} y2={y} className={styles.gridLine} />
              <text x="40" y={y + 4} textAnchor="end" className={styles.axisText}>{money(value)}</text>
            </g>
          );
        })}
        {data.length > 0 && <path d={areaPath} className={styles.chartArea} />}
        {data.length > 0 && <path d={previousPath} className={styles.previousLine} />}
        {data.length > 0 && <path d={currentPath} className={styles.currentLine} />}
        {data.map((point) => tickDays.includes(point.day) && (
          <text key={point.day} x={48 + ((point.day - 1) / Math.max(data.length - 1, 1)) * chartWidth} y="239" textAnchor="middle" className={styles.axisText}>
            {point.day} {point.day === 1 || point.day === data.length ? monthAbbreviation : ""}
          </text>
        ))}
      </svg>
      {maximumValue === 0 && <p className={styles.chartEmpty}>Your spending in {monthName} will appear here as transactions are added.</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ importId?: string }>;
} = {}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const resolvedParams = searchParams ? await searchParams : undefined;
  const requestedImportId = resolvedParams?.importId ? parseInt(resolvedParams.importId, 10) : undefined;


  const now = new Date();
  const [duplicateImportIds, duplicateTransactionIds] = await Promise.all([
    getDuplicateImportIds(session.id),
    getDuplicateTransactionIds(session.id),
  ]);

  const latestImport = await prisma.import.findFirst({
    where: {
      userId: session.id,
      status: "COMPLETED",
      ...(requestedImportId
        ? { id: requestedImportId }
        : duplicateImportIds.length > 0
          ? { id: { notIn: duplicateImportIds } }
          : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, fileName: true, transactionCount: true, createdAt: true },
  });

  const latestImportTotals = latestImport
    ? await prisma.transaction.groupBy({
        by: ["type"],
        where: { userId: session.id, importId: latestImport.id, type: { in: ["INCOME", "EXPENSE"] } },
        _sum: { amount: true },
      })
    : [];
  const latestImportIncome = Number(latestImportTotals.find((total) => total.type === "INCOME")?._sum.amount ?? 0);
  const latestImportSpent = Number(latestImportTotals.find((total) => total.type === "EXPENSE")?._sum.amount ?? 0);

  const latestExpense = await prisma.transaction.findFirst({
    where: requestedImportId
      ? { userId: session.id, importId: requestedImportId, type: "EXPENSE" }
      : excludeDuplicateTransactions(
          { userId: session.id, type: "EXPENSE", transactionDate: { lte: now } },
          duplicateTransactionIds,
          duplicateImportIds,
        ),
    orderBy: { transactionDate: "desc" },
    select: { transactionDate: true },
  });

  const hasCurrentMonthSpending = latestExpense
    ? latestExpense.transactionDate.getFullYear() === now.getFullYear()
      && latestExpense.transactionDate.getMonth() === now.getMonth()
    : false;
  const periodDate = latestExpense && !hasCurrentMonthSpending ? endOfMonth(latestExpense.transactionDate) : now;

  const data = await getDashboardData(
    session.id,
    periodDate,
    duplicateImportIds,
    duplicateTransactionIds,
    requestedImportId,
  );

  const primaryDate = data.recentTransactions[0]?.date || latestExpense?.transactionDate || periodDate;
  const monthName = format(primaryDate, "MMMM yyyy");
  const periodMonthName = format(primaryDate, "MMMM");
  const previousMonth = subMonths(primaryDate, 1);
  const previousMonthName = format(previousMonth, "MMMM yyyy");
  const changeDown = data.changePercent < 0;
  const comparisonDelta = data.currentTotal - data.lastTotal;
  const firstName = session.name.trim().split(/\s+/)[0] || "there";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  let categoryCursor = 0;
  const donutStops = data.sortedCategories.map((category) => {
    const portion = data.currentTotal > 0 ? (category.amount / data.currentTotal) * 100 : 0;
    const stop = `${category.color} ${categoryCursor}% ${categoryCursor + portion}%`;
    categoryCursor += portion;
    return stop;
  });
  if (categoryCursor < 100) donutStops.push(`#263342 ${categoryCursor}% 100%`);
  const donutStyle = { background: `conic-gradient(${donutStops.join(", ") || "#263342 0 100%"})` } as CSSProperties;
  const merchantMax = Math.max(1, ...data.merchantData.map((merchant) => merchant.amount));
  const leakItems = [
    { name: "Food delivery", amount: data.foodDeliveryTotal, percent: data.currentTotal ? (data.foodDeliveryTotal / data.currentTotal) * 100 : 0, icon: "food" as const },
    { name: "Small purchases", amount: data.smallTotal, percent: data.smallPercent, icon: "wallet" as const },
  ].filter((item) => item.amount > 0);

  return (
    <div className={styles.page} data-dashboard-home="true">
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.overline}><span /> YOUR MONEY, AT A GLANCE</p>
          <h1>{greeting}, {firstName}</h1>
          <p className={styles.subtitle}>
            {requestedImportId
              ? `Showing activity from ${latestImport?.fileName ?? "selected import"}.`
              : latestImport
                ? `Your account activity in ${monthName}, across imported statements.`
                : "Import a statement to see your account activity."}
          </p>
        </div>
        <Link href="/imports" className={styles.importButton}>
          <DashboardIcon name="import" size={17} />
          Import statement
        </Link>
      </div>

      {latestImport && (
        <article className={`${styles.panel} ${styles.latestImportPanel}`} aria-label="Latest statement summary">
          <div className={styles.latestImportMeta}>
            <p>{requestedImportId ? "Selected statement" : "Latest statement"}</p>
            <strong title={latestImport.fileName}>{latestImport.fileName}</strong>
            <small>{latestImport.transactionCount.toLocaleString("en-IN")} transactions in this file</small>
          </div>
          <div className={styles.latestImportIncome}>
            <span>Received in this file</span>
            <strong>{money(latestImportIncome)}</strong>
          </div>
          <div className={styles.latestImportSpend}>
            <span>Spent in this file</span>
            <strong>{money(latestImportSpent)}</strong>
          </div>
          <Link href={`/imports/${latestImport.id}`} className={styles.accentLink}>View this import <DashboardIcon name="arrowRight" size={13} /></Link>
        </article>
      )}

      <section className={styles.kpiGrid} aria-label="Monthly spending summary">
        <article className={styles.kpiCard}>
          <span className={`${styles.kpiIcon} ${styles.greenIcon}`}><DashboardIcon name="wallet" size={20} /></span>
          <div className={styles.kpiContent}>
            <p className={styles.kpiLabel}>Total spent</p>
            <p className={styles.kpiValue}>{money(data.currentTotal)}</p>
            <p className={`${styles.kpiFoot} ${changeDown ? styles.goodChange : styles.badChange}`}>
              <DashboardIcon name="trend" size={14} />
              {Math.abs(data.changePercent).toFixed(1)}% vs {format(previousMonth, "MMMM")}
            </p>
          </div>
          <DashboardIcon name="trend" size={19} />
        </article>
        <article className={styles.kpiCard}>
          <span className={`${styles.kpiIcon} ${styles.blueIcon}`}><DashboardIcon name="arrows" size={20} /></span>
          <div className={styles.kpiContent}>
            <p className={styles.kpiLabel}>Transactions</p>
            <p className={styles.kpiValue}>{data.transactionCount.toLocaleString("en-IN")}</p>
            <p className={styles.kpiFoot}>{periodMonthName}</p>
          </div>
          <DashboardIcon name="trend" size={19} />
        </article>
        <article className={styles.kpiCard}>
          <span className={`${styles.kpiIcon} ${styles.purpleIcon}`}><DashboardIcon name="shield" size={20} /></span>
          <div className={styles.kpiContent}>
            <p className={styles.kpiLabel}>Small purchases</p>
            <p className={styles.kpiValue}>{money(data.smallTotal)}</p>
            <p className={styles.kpiFoot}>{data.smallPercent.toFixed(0)}% of total spend</p>
          </div>
          <DashboardIcon name="trend" size={19} />
        </article>
        <article className={styles.kpiCard}>
          <span className={`${styles.kpiIcon} ${styles.orangeIcon}`}><DashboardIcon name="food" size={20} /></span>
          <div className={styles.kpiContent}>
            <p className={styles.kpiLabel}>Food delivery</p>
            <p className={styles.kpiValue}>{money(data.foodDeliveryTotal)}</p>
            <p className={styles.kpiFoot}>{data.currentTotal ? ((data.foodDeliveryTotal / data.currentTotal) * 100).toFixed(1) : "0.0"}% of total spend</p>
          </div>
          <DashboardIcon name="trend" size={19} />
        </article>
      </section>

      <section className={styles.analysisGrid} aria-label="Spending analysis">
        <article className={`${styles.panel} ${styles.spendingPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Spending over time</h2>
              <p>Day by day, compared with last month</p>
            </div>
            <Link href="/compare" className={styles.subtleLink}>Compare <DashboardIcon name="arrowRight" size={14} /></Link>
          </div>
          <SpendingChart data={data.dailySpend} monthName={periodMonthName} monthAbbreviation={format(periodDate, "MMM")} previousMonthName={format(previousMonth, "MMMM")} />
        </article>

        <article className={`${styles.panel} ${styles.categoryPanel}`}>
          <div className={styles.panelHeader}>
            <div><h2>Spending by category</h2><p>Your biggest spending areas</p></div>
          </div>
          <div className={styles.categoryContent}>
            <div className={styles.donut} style={donutStyle}>
              <div className={styles.donutCenter}>
                <strong>{money(data.currentTotal)}</strong>
                <span>Total spent</span>
              </div>
            </div>
            {data.sortedCategories.length > 0 ? (
              <ul className={styles.categoryLegend}>
                {data.sortedCategories.map((category) => (
                  <li key={category.name}>
                    <span className={styles.categoryName}><i style={{ backgroundColor: category.color }} />{category.name}</span>
                    <span>{data.currentTotal ? ((category.amount / data.currentTotal) * 100).toFixed(0) : 0}%</span>
                    <strong>{money(category.amount)}</strong>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.emptyCopy}>Import a statement to see your category breakdown.</p>}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.leaksPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.leaksTitle}><DashboardIcon name="alert" size={17} /><h2>Money leaks</h2></div>
            <Link href="/transactions" className={styles.accentLink}>View all <DashboardIcon name="arrowRight" size={13} /></Link>
          </div>
          <div className={styles.leakList}>
            {leakItems.length > 0 ? leakItems.map((item, index) => (
              <div className={styles.leakCard} key={item.name}>
                <span className={`${styles.leakRail} ${index === 0 ? styles.coralRail : styles.orangeRail}`} />
                <span className={`${styles.leakIcon} ${index === 0 ? styles.coralIcon : styles.orangeIcon}`}><DashboardIcon name={item.icon} size={18} /></span>
                <div className={styles.leakCopy}>
                  <strong>{item.name}</strong>
                  <b>{money(item.amount)}</b>
                  <span>{item.percent.toFixed(1)}% of total spend</span>
                </div>
                <DashboardIcon name="chevron" size={16} />
              </div>
            )) : (
              <div className={styles.noLeaks}><span>✦</span><strong>No leaks spotted yet</strong><p>Your spending patterns will show up here.</p></div>
            )}
            <div className={styles.insightCard}>
              <span className={styles.insightBulb}><DashboardIcon name="lightbulb" size={17} /></span>
              <p><strong>{data.foodDeliveryTotal > 0 || data.smallTotal > 0 ? "A small change adds up" : "Your money, made clearer"}</strong>
                <span>{data.foodDeliveryTotal > 0 || data.smallTotal > 0
                  ? `Try trimming these two areas by 20% to keep more of your ${periodMonthName} budget.`
                  : "Import a statement to find useful ways to save."}</span>
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.activityGrid} aria-label="Recent activity and monthly comparison">
        <article className={`${styles.panel} ${styles.merchantPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWithIcon}><DashboardIcon name="merchants" size={18} /><div><h2>Top merchants</h2><p>Where you spent the most</p></div></div>
            <Link href="/settings/merchants" className={styles.subtleLink}>View all <DashboardIcon name="arrowRight" size={14} /></Link>
          </div>
          {data.merchantData.length > 0 ? (
            <ol className={styles.merchantList}>
              {data.merchantData.map((merchant, index) => (
                <li key={merchant.name}>
                  <span className={styles.merchantRank}>{index + 1}</span>
                  <span className={styles.merchantAvatar} style={{ backgroundColor: chartPalette[(index + 1) % chartPalette.length] }}>{merchant.name.slice(0, 1).toUpperCase()}</span>
                  <div className={styles.merchantInfo}>
                    <div className={styles.merchantLine}><strong>{merchant.name}</strong><b>{money(merchant.amount)}</b></div>
                    <div className={styles.merchantLine}><span>{merchant.count} {merchant.count === 1 ? "transaction" : "transactions"}</span></div>
                    <span className={styles.merchantTrack}><i style={{ width: `${Math.max(5, (merchant.amount / merchantMax) * 100)}%`, backgroundColor: chartPalette[(index + 1) % chartPalette.length] }} /></span>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className={styles.emptyCopy}>Your most visited merchants will appear here.</p>}
        </article>

        <article className={`${styles.panel} ${styles.transactionsPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWithIcon}><DashboardIcon name="clock" size={18} /><div><h2>Recent transactions</h2><p>Your latest activity in {periodMonthName}</p></div></div>
            <Link href="/transactions" className={styles.accentLink}>View all <DashboardIcon name="arrowRight" size={13} /></Link>
          </div>
          {data.recentTransactions.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.transactionTable}>
                <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th className={styles.amountHeading}>Amount</th></tr></thead>
                <tbody>
                  {data.recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{format(transaction.date, "d MMM")}</td>
                      <td><Link href={`/transactions/${transaction.id}`} className={styles.transactionMerchant}>
                        <span className={styles.transactionAvatar} style={{ backgroundColor: transaction.categoryColor }}>{transaction.merchant.slice(0, 1).toUpperCase()}</span>
                        <span>{transaction.merchant}</span>
                      </Link></td>
                      <td><span className={styles.categoryPill} style={{ "--pill-color": transaction.categoryColor } as CSSProperties}>{transaction.category}</span></td>
                      <td className={styles.amountCell}>−{money(transaction.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className={styles.emptyCopy}>New transactions appear here after you import a statement.</p>}
        </article>

        <article className={`${styles.panel} ${styles.comparisonPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWithIcon}><DashboardIcon name="reports" size={18} /><div><h2>Monthly comparison</h2><p>{format(previousMonth, "MMMM")} vs {periodMonthName}</p></div></div>
          </div>
          <div className={styles.comparisonTotals}>
            <div><span>{periodMonthName}</span><strong>{money(data.currentTotal)}</strong></div>
            <span className={styles.comparisonDivider} />
            <div><span>Last month</span><strong>{money(data.lastTotal)}</strong></div>
          </div>
          <p className={`${styles.comparisonChange} ${changeDown ? styles.goodChange : styles.badChange}`}>
            <DashboardIcon name="trend" size={16} />
            {Math.abs(data.changePercent).toFixed(1)}% <span>{comparisonDelta >= 0 ? "+" : "−"}{money(Math.abs(comparisonDelta))}</span>
          </p>
          <div className={styles.monthBars}>
            <div className={styles.monthBarGroup}>
              <span className={styles.barValue}>{money(data.lastTotal)}</span>
              <span className={styles.monthBar} style={{ height: `${Math.max(8, data.lastTotal / Math.max(data.currentTotal, data.lastTotal, 1) * 100)}%` }} />
              <span className={styles.monthLabel}>{format(previousMonth, "MMM")}</span>
            </div>
            <div className={styles.monthBarGroup}>
              <span className={styles.barValue}>{money(data.currentTotal)}</span>
              <span className={`${styles.monthBar} ${styles.currentMonthBar}`} style={{ height: `${Math.max(8, data.currentTotal / Math.max(data.currentTotal, data.lastTotal, 1) * 100)}%` }} />
              <span className={styles.monthLabel}>{format(periodDate, "MMM")}</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
