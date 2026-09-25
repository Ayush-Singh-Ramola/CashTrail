import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { generateReport } from "@/lib/analytics/report";
import { format, getDaysInMonth } from "date-fns";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DashboardIcon } from "@/components/dashboard-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import AiExplanation from "./ai-explanation";
import SpendingOverviewChart from "./spending-overview-chart";
import styles from "./report.module.css";

const palette = ["#89df4b", "#3987f4", "#9e72ef", "#f39646", "#eb6277", "#8293a9"];
const money = (amount: number) => "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function safeColor(color: string | null, index: number) {
  return color && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) ? color : palette[index % palette.length];
}

export default async function ReportPage({ params }: PageProps<"/reports/[year]/[month]">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);
  if (!/^\d{4}$/.test(year) || !Number.isInteger(yearNum) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) notFound();

  const report = await generateReport(session.id, yearNum, monthNum);
  const selectedDate = new Date(yearNum, monthNum - 1, 1);
  const previousDate = new Date(yearNum, monthNum - 2, 1);
  const daysInMonth = getDaysInMonth(selectedDate);
  const averageDaily = report.totalExpense / daysInMonth;
  const changeDown = report.monthOverMonth.change <= 0;
  const previousLabel = report.monthOverMonth.previousMonthName.replace(/\s+\d{4}$/, "");
  const allCategories = report.categoryBreakdown.map((category, index) => ({
    name: category.name,
    amount: category.amount,
    percentage: category.percentage,
    color: safeColor(category.color, index),
  }));
  const categories = allCategories.length > 6
    ? [
        ...allCategories.slice(0, 5),
        {
          name: "Other",
          amount: allCategories.slice(5).reduce((sum, category) => sum + category.amount, 0),
          percentage: allCategories.slice(5).reduce((sum, category) => sum + category.percentage, 0),
          color: palette[5],
        },
      ]
    : allCategories;
  let donutCursor = 0;
  const donutSegments = categories.map((category) => {
    const segment = category.color + " " + donutCursor + "% " + (donutCursor + category.percentage) + "%";
    donutCursor += category.percentage;
    return segment;
  });
  if (donutCursor < 100) donutSegments.push("#263342 " + donutCursor + "% 100%");
  const donutStyle = { background: "conic-gradient(" + (donutSegments.join(", ") || "#263342 0 100%") + ")" } as CSSProperties;
  const merchantMax = Math.max(1, ...report.topMerchants.map((merchant) => merchant.amount));
  const leakItems: { name: string; amount: number; share: number; icon: "food" | "wallet" }[] = [
    ...(report.foodDeliveryTotal > 0 ? [{ name: "Food delivery", amount: report.foodDeliveryTotal, share: report.totalExpense > 0 ? report.foodDeliveryTotal / report.totalExpense * 100 : 0, icon: "food" as const }] : []),
    ...(report.smallPurchases.total > 0 ? [{ name: "Small purchases", amount: report.smallPurchases.total, share: report.smallPurchases.percentage, icon: "wallet" as const }] : []),
  ];
  if (leakItems.length === 0 && report.biggestLeaks[0]) {
    leakItems.push({ name: report.biggestLeaks[0].name, amount: report.biggestLeaks[0].amount, share: report.totalExpense > 0 ? report.biggestLeaks[0].amount / report.totalExpense * 100 : 0, icon: "wallet" });
  }

  return (
    <div className={styles.page} data-report-page="true">
      <header className={styles.reportHeader}>
        <div className={styles.reportHeading}>
          <Link href="/dashboard" className={styles.backLink}><span aria-hidden="true">←</span> Back to dashboard</Link>
          <p className={styles.eyebrow}><span /> MONTHLY REPORT</p>
          <h1>Money Autopsy</h1>
          <p className={styles.description}>A detailed view of your spending, income, and financial patterns for {report.monthName}.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href={"/reports/" + previousDate.getFullYear() + "/" + (previousDate.getMonth() + 1)} className={styles.secondaryButton}>Previous month</Link>
          <Link href="/compare" className={styles.primaryButton}><DashboardIcon name="compare" size={16} />Compare months</Link>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="Monthly financial summary">
        <Metric label="Money received" value={money(report.totalIncome)} icon="wallet" tone="green" detail={report.totalIncome > 0 ? "Income this month" : "No income this month"} />
        <Metric label="Money spent" value={money(report.totalExpense)} icon="arrows" tone="blue" detail={Math.abs(report.monthOverMonth.changePercent).toFixed(1) + "% vs " + previousLabel} detailTone={changeDown ? "good" : "bad"} />
        <Metric label="Total expenses" value={money(report.totalExpense)} icon="shield" tone="orange" detail={report.totalIncome > 0 ? (report.totalExpense / report.totalIncome * 100).toFixed(0) + "% of income" : "All recorded expenses"} />
        <Metric label="Avg. daily spending" value={money(averageDaily)} icon="reports" tone="purple" detail={daysInMonth + " days in " + format(selectedDate, "MMMM")} />
      </section>

      <section className={styles.analysisGrid} aria-label="Monthly spending analysis">
        <article className={styles.panel + " " + styles.spendingPanel}>
          <PanelHeading title="Spending overview" description="Daily expenses compared with last month" />
          <SpendingOverviewChart data={report.dailySpend} monthName={format(selectedDate, "MMMM yyyy")} previousMonthName={previousLabel} monthAbbreviation={format(selectedDate, "MMM")} />
        </article>
        <article className={styles.panel + " " + styles.categoryPanel}>
          <PanelHeading title="Spending by category" description="Where your money went this month" />
          <div className={styles.categoryContent}>
            <div className={styles.donut} style={donutStyle}><div className={styles.donutCenter}><strong>{money(report.totalExpense)}</strong><span>Total spent</span></div></div>
            {categories.length > 0 ? <ul className={styles.categoryLegend}>{categories.map((category) => (
              <li key={category.name}><span className={styles.categoryName}><i style={{ backgroundColor: category.color }} />{category.name}</span><span>{category.percentage.toFixed(1)}%</span><strong>{money(category.amount)}</strong></li>
            ))}</ul> : <Empty>No expense transactions were imported for this month.</Empty>}
          </div>
        </article>
        <article className={styles.panel + " " + styles.leaksPanel}>
          <div className={styles.panelTitleRow}><div className={styles.leaksHeading}><DashboardIcon name="alert" size={17} /><h2>Money leaks</h2></div><Link href="/transactions" className={styles.accentLink}>View all <DashboardIcon name="arrowRight" size={13} /></Link></div>
          <div className={styles.leakList}>
            {leakItems.length > 0 ? leakItems.map((item, index) => <div className={styles.leakCard} key={item.name}>
              <span className={styles.leakRail + " " + (index === 0 ? styles.coralRail : styles.orangeRail)} />
              <span className={styles.leakIcon + " " + (index === 0 ? styles.coralIcon : styles.orangeIcon)}><DashboardIcon name={item.icon} size={17} /></span>
              <div className={styles.leakCopy}><strong>{item.name}</strong><b>{money(item.amount)}</b><span>{item.share.toFixed(1)}% of total spending</span></div>
              <DashboardIcon name="chevron" size={16} />
            </div>) : <div className={styles.noLeaks}><span>✦</span><strong>No leaks spotted yet</strong><p>Spending patterns will appear as activity comes in.</p></div>}
            <div className={styles.insightCard}><span><DashboardIcon name="lightbulb" size={17} /></span><p><strong>A little can add up</strong><small>Small changes to frequent spending can leave more room in your monthly budget.</small></p></div>
          </div>
        </article>
      </section>

      <section className={styles.activityGrid} aria-label="Monthly activity">
        <article className={styles.panel + " " + styles.merchantPanel}>
          <div className={styles.panelTitleRow}><PanelHeading title="Top merchants" description="Your highest spending merchants" icon="merchants" /><Link href="/settings/merchants" className={styles.subtleLink}>View all <DashboardIcon name="arrowRight" size={13} /></Link></div>
          {report.topMerchants.length > 0 ? <ol className={styles.merchantList}>{report.topMerchants.slice(0, 5).map((merchant, index) => <li key={merchant.merchantId}>
            <span className={styles.merchantRank}>{index + 1}</span><span className={styles.merchantAvatar} style={{ backgroundColor: palette[(index + 1) % palette.length] }}>{merchant.name.slice(0, 1).toUpperCase()}</span>
            <div className={styles.merchantInfo}><div><strong>{merchant.name}</strong><b>{money(merchant.amount)}</b></div><small>{merchant.count} {merchant.count === 1 ? "transaction" : "transactions"}</small><span className={styles.merchantTrack}><i style={{ width: Math.max(5, merchant.amount / merchantMax * 100) + "%", backgroundColor: palette[(index + 1) % palette.length] }} /></span></div>
          </li>)}</ol> : <Empty>No merchant totals are available for this month.</Empty>}
        </article>

        <article className={styles.panel + " " + styles.transactionsPanel}>
          <div className={styles.panelTitleRow}><PanelHeading title="Recent transactions" description="Your latest activity this month" icon="clock" /><Link href="/transactions" className={styles.accentLink}>View all <DashboardIcon name="arrowRight" size={13} /></Link></div>
          {report.recentTransactions.length > 0 ? <div className={styles.tableScroll}><table className={styles.transactionTable}>
            <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Amount</th><th>Type</th></tr></thead>
            <tbody>{report.recentTransactions.map((transaction) => {
              const color = safeColor(transaction.categoryColor, 0);
              const prefix = transaction.type === "EXPENSE" ? "−" : transaction.type === "INCOME" ? "+" : "";
              return <tr key={transaction.id}>
                <td>{format(transaction.date, "d MMM")}</td>
                <td><Link href={"/transactions/" + transaction.id} className={styles.transactionMerchant}><span style={{ backgroundColor: color }}>{transaction.merchantName.slice(0, 1).toUpperCase()}</span>{transaction.merchantName}</Link></td>
                <td><span className={styles.tableCategory} style={{ "--category-color": color } as CSSProperties}>{transaction.categoryName}</span></td>
                <td className={styles.transactionAmount}>{prefix}{transaction.type === "TRANSFER" ? "" : "₹"}{transaction.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                <td><Badge variant={transaction.type === "INCOME" ? "success" : transaction.type === "TRANSFER" ? "info" : "danger"} className={styles.typeTag}>{transaction.type}</Badge></td>
              </tr>;
            })}</tbody>
          </table></div> : <Empty>No transactions were imported for this month.</Empty>}
        </article>

        <article className={styles.panel + " " + styles.comparisonPanel}>
          <PanelHeading title="Monthly comparison" description={previousLabel + " vs " + format(selectedDate, "MMMM")} icon="reports" />
          <div className={styles.comparisonTotals}><div><span>This month</span><strong>{money(report.totalExpense)}</strong></div><i /><div><span>Last month</span><strong>{money(report.monthOverMonth.previousTotal)}</strong></div></div>
          <p className={styles.comparisonChange + " " + (changeDown ? styles.goodChange : styles.badChange)}><DashboardIcon name="trend" size={15} />{Math.abs(report.monthOverMonth.changePercent).toFixed(1)}%<span>{report.monthOverMonth.change >= 0 ? "+" : "−"}{money(Math.abs(report.monthOverMonth.change))}</span></p>
          <div className={styles.monthBars}>
            <MonthBar label={previousLabel.slice(0, 3)} amount={report.monthOverMonth.previousTotal} max={Math.max(report.monthOverMonth.previousTotal, report.totalExpense, 1)} />
            <MonthBar label={format(selectedDate, "MMM")} amount={report.totalExpense} max={Math.max(report.monthOverMonth.previousTotal, report.totalExpense, 1)} current />
          </div>
        </article>
      </section>

      <section className={styles.detailGrid} aria-label="Detailed report insights">
        <article className={styles.panel}><PanelHeading title="Likely recurring payments" description="Suggested from repeated merchant, amount, and date patterns" />
          {report.recurringPayments.length > 0 ? <ul className={styles.detailList}>{report.recurringPayments.map((payment, index) => <li key={payment.type + "-" + index}><div><strong>{payment.description}</strong><p>{payment.count} matching charge{payment.count === 1 ? "" : "s"} this month</p></div><b>{money(payment.totalAmount)}</b></li>)}</ul> : <Empty>No likely recurring payments were detected for this month.</Empty>}
        </article>
        <article className={styles.panel}><PanelHeading title="Spending patterns" description="Patterns observed in your transaction history" />
          {report.patterns.length > 0 ? <ul className={styles.patternList}>{report.patterns.map((pattern, index) => <li key={pattern.type + "-" + index}><div><strong>{pattern.label}</strong><p>{pattern.description}</p><small>{pattern.count} transactions · {pattern.percentageOfSpending.toFixed(1)}% of spending</small></div><b>{money(pattern.totalAmount)}</b></li>)}</ul> : <Empty>There is not enough matching activity this month to surface a pattern.</Empty>}
        </article>
        <article className={styles.panel}><PanelHeading title="Your classifications" description="Spending grouped by your labels" />
          {report.classificationBreakdown.length > 0 ? <ul className={styles.classificationList}>{report.classificationBreakdown.map((item) => <li key={item.classification}><span>{item.classification === "UNCLASSIFIED" ? "Unclassified" : item.classification.toLowerCase()}</span><b>{money(item.amount)} <small>· {item.count}</small></b></li>)}</ul> : <Empty>No expense transactions were imported for this month.</Empty>}
          <Link href="/transactions" className={styles.detailLink}>Review transactions <DashboardIcon name="arrowRight" size={14} /></Link>
        </article>
        <article className={styles.panel}><PanelHeading title={"Compared with " + report.monthOverMonth.previousMonthName} description="Change in spending by category" />
          {!report.monthOverMonth.hasPreviousTransactions ? <Empty>No expense transactions were imported for the previous month.</Empty> : <><p className={styles.comparisonSummary}>Spending {report.monthOverMonth.change > 0 ? "increased" : report.monthOverMonth.change < 0 ? "decreased" : "was unchanged"} by <strong>{money(Math.abs(report.monthOverMonth.change))}</strong> ({Math.abs(report.monthOverMonth.changePercent).toFixed(1)}%).</p><ul className={styles.categoryChanges}>{report.monthOverMonth.categoryChanges.slice(0, 6).map((item) => <li key={item.category}><span>{item.category}</span><b className={item.change <= 0 ? styles.goodChange : styles.badChange}>{item.change >= 0 ? "+" : "−"}{money(Math.abs(item.change))}</b></li>)}</ul></>}
        </article>
        <article className={styles.panel + " " + styles.summaryPanel}><PanelHeading title="Monthly summary" description="Calculated overview of this month's activity" /><p>{report.explanation}</p></article>
      </section>

      <AiExplanation year={yearNum} month={monthNum} configured={Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)} />
    </div>
  );
}

function Metric({ label, value, icon, tone, detail, detailTone }: { label: string; value: string; icon: "wallet" | "arrows" | "shield" | "reports"; tone: "green" | "blue" | "orange" | "purple"; detail: string; detailTone?: "good" | "bad" }) {
  const toneClass = tone === "green" ? styles.green : tone === "blue" ? styles.blue : tone === "orange" ? styles.orange : styles.purple;
  const detailClass = detailTone === "good" ? styles.good : detailTone === "bad" ? styles.bad : "";
  return <Card className={styles.metric}><span className={styles.metricIcon + " " + toneClass}><DashboardIcon name={icon} size={19} /></span><div><p>{label}</p><strong>{value}</strong><small className={detailClass}>{detail}</small></div><DashboardIcon name="trend" size={18} /></Card>;
}

function PanelHeading({ title, description, icon }: { title: string; description?: string; icon?: "merchants" | "clock" | "reports" }) {
  return <div className={styles.panelHeading}>{icon && <DashboardIcon name={icon} size={18} />}<div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;
}

function MonthBar({ label, amount, max, current = false }: { label: string; amount: number; max: number; current?: boolean }) {
  return <div className={styles.monthBarGroup}><span>{money(amount)}</span><i className={current ? styles.currentBar : ""} style={{ height: Math.max(8, amount / max * 100) + "%" }} /><small>{label}</small></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
