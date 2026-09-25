"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DashboardIcon } from "@/components/dashboard-icon";
import styles from "./compare.module.css";

type ComparisonItem = {
  category: string;
  month1: number;
  month2: number;
  change: number;
  changePercent: number;
};

type ComparisonData = {
  month1: { year: number; month: number; name: string; total: number };
  month2: { year: number; month: number; name: string; total: number };
  comparison: ComparisonItem[];
  biggestIncrease: { category: string; change: number } | null;
  biggestDecrease: { category: string; change: number } | null;
};

type MonthOption = {
  value: string;
  year: number;
  month: number;
  label: string;
};

function monthValue(year: number, month: number) {
  return year + "-" + String(month).padStart(2, "0");
}

function readMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactMoney(value: number) {
  const amount = Math.abs(value);
  if (amount >= 100000) return "₹" + (value / 100000).toFixed(amount >= 1000000 ? 0 : 1) + "L";
  if (amount >= 1000) return "₹" + (value / 1000).toFixed(amount >= 10000 ? 0 : 1) + "k";
  return "₹" + Math.round(value);
}

function shortCategory(category: string) {
  return category.length > 14 ? category.slice(0, 12) + "…" : category;
}

function monthOptionsFrom(date: Date): MonthOption[] {
  return Array.from({ length: 36 }, (_, index) => {
    const monthDate = subMonths(date, index);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    return {
      value: monthValue(year, month),
      year,
      month,
      label: format(monthDate, "MMMM yyyy"),
    };
  });
}

const chartConfig: ChartConfig = {
  month1: { label: "First month", color: "#a7b2c2" },
  month2: { label: "Second month", color: "#76c94a" },
};

export default function ComparePage() {
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [month1, setMonth1] = useState("");
  const [month2, setMonth2] = useState("");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const options = monthOptionsFrom(new Date());
    setMonthOptions(options);
    setMonth1(options[1]?.value ?? "");
    setMonth2(options[0]?.value ?? "");
  }, []);

  const fetchComparison = useCallback(async (firstMonth: string, secondMonth: string) => {
    if (!firstMonth || !secondMonth) return;
    const first = readMonthValue(firstMonth);
    const second = readMonthValue(secondMonth);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/analytics/compare?y1=" + first.year + "&m1=" + first.month
          + "&y2=" + second.year + "&m2=" + second.month,
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Unable to compare these months.");
      }
      setComparison(result as ComparisonData);
    } catch (cause) {
      setComparison(null);
      setError(cause instanceof Error ? cause.message : "Unable to compare these months.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (month1 && month2) void fetchComparison(month1, month2);
  }, [month1, month2, fetchComparison]);

  const month1Label = useMemo(() => {
    const option = monthOptions.find((item) => item.value === month1);
    return option?.label ?? comparison?.month1.name ?? "First month";
  }, [comparison?.month1.name, month1, monthOptions]);
  const month2Label = useMemo(() => {
    const option = monthOptions.find((item) => item.value === month2);
    return option?.label ?? comparison?.month2.name ?? "Second month";
  }, [comparison?.month2.name, month2, monthOptions]);

  const chartData = useMemo(() => {
    if (!comparison) return [];
    return [...comparison.comparison]
      .sort((a, b) => (b.month1 + b.month2) - (a.month1 + a.month2))
      .slice(0, 8)
      .map((item) => ({
        ...item,
        label: shortCategory(item.category),
      }));
  }, [comparison]);

  const changedCategories = useMemo(
    () => comparison?.comparison.slice(0, 6) ?? [],
    [comparison],
  );

  const biggestChange = useMemo(() => {
    if (!comparison?.comparison.length) return null;
    return comparison.comparison.reduce((largest, item) =>
      Math.abs(item.change) > Math.abs(largest.change) ? item : largest,
    );
  }, [comparison]);

  const spendingChange = comparison ? comparison.month2.total - comparison.month1.total : 0;
  const spendingChangePercent = comparison && comparison.month1.total > 0
    ? (spendingChange / comparison.month1.total) * 100
    : 0;
  const changeIsSaving = spendingChange <= 0;

  function compareSelectedMonths() {
    void fetchComparison(month1, month2);
  }

  return (
    <main className={styles.page} data-compare-page="true">
      <section className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <span className={styles.titleIcon}><DashboardIcon name="compare" size={20} /></span>
          <div>
            <p className={styles.eyebrow}>YOUR MONEY, SIDE BY SIDE</p>
            <h1>Month Comparison</h1>
            <p className={styles.subtitle}>See what changed and where your money went.</p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.selectGroup}>
            <span>First month</span>
            <select value={month1} onChange={(event) => setMonth1(event.target.value)} disabled={!monthOptions.length}>
              {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <span className={styles.versus}>vs</span>
          <label className={styles.selectGroup}>
            <span>Second month</span>
            <select value={month2} onChange={(event) => setMonth2(event.target.value)} disabled={!monthOptions.length}>
              {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className={styles.compareButton} type="button" onClick={compareSelectedMonths} disabled={!month1 || !month2 || loading}>
            <DashboardIcon name="arrows" size={16} />
            {loading ? "Comparing…" : "Compare months"}
          </button>
        </div>
      </section>

      {error && <div className={styles.errorNotice} role="alert">{error}</div>}

      <section className={styles.summaryGrid} aria-label="Comparison summary">
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon + " " + styles.firstMonthIcon}><DashboardIcon name="calendar" size={19} /></div>
          <div className={styles.summaryCopy}>
            <p className={styles.cardLabel}>{month1Label} spending</p>
            <strong>{comparison ? money(comparison.month1.total) : loading ? "Loading…" : "—"}</strong>
            <small>First month</small>
          </div>
          <span className={styles.monthTag}>{comparison?.month1.name ?? "Month 1"}</span>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon + " " + styles.secondMonthIcon}><DashboardIcon name="calendar" size={19} /></div>
          <div className={styles.summaryCopy}>
            <p className={styles.cardLabel}>{month2Label} spending</p>
            <strong>{comparison ? money(comparison.month2.total) : loading ? "Loading…" : "—"}</strong>
            <small>Second month</small>
          </div>
          <span className={styles.monthTag + " " + styles.currentTag}>{comparison?.month2.name ?? "Month 2"}</span>
        </Card>
        <Card className={styles.deltaCard}>
          <div className={styles.summaryIcon + " " + (changeIsSaving ? styles.savingIcon : styles.increaseIcon)}>
            <DashboardIcon name={changeIsSaving ? "trend" : "alert"} size={19} />
          </div>
          <div className={styles.summaryCopy}>
            <p className={styles.cardLabel}>Change in spending</p>
            <strong className={changeIsSaving ? styles.goodText : styles.badText}>
              {comparison ? (spendingChange > 0 ? "+" : "−") + money(Math.abs(spendingChange)) : loading ? "Loading…" : "—"}
            </strong>
            <small>{comparison ? Math.abs(spendingChangePercent).toFixed(1) + "% " + (changeIsSaving ? "less spent" : "more spent") : "Compared total"}</small>
          </div>
          <span className={styles.deltaSpark} aria-hidden="true">
            <svg viewBox="0 0 72 32"><path d={changeIsSaving ? "M2 7 17 12 31 11 46 20 70 26" : "M2 25 17 19 31 21 46 12 70 6"} /></svg>
          </span>
        </Card>
      </section>

      <section className={styles.analysisGrid} aria-label="Spending analysis">
        <Card className={styles.panel}>
          <PanelHeading title="Spending by category" subtitle="Compare category totals across both months" icon="reports" />
          <div className={styles.chartLegend}>
            <span><i className={styles.legendFirst} />{month1Label}</span>
            <span><i className={styles.legendSecond} />{month2Label}</span>
          </div>
          <div className={styles.chartArea}>
            {chartData.length ? (
              <ChartContainer config={chartConfig} className={styles.chart}>
                <BarChart data={chartData} margin={{ top: 12, right: 8, left: 2, bottom: 7 }} barGap={4} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke="#263342" strokeDasharray="3 4" />
                  <XAxis dataKey="label" tick={{ fill: "#8491a1", fontSize: 10 }} tickLine={false} axisLine={false} tickMargin={9} />
                  <YAxis tickFormatter={(value: number) => compactMoney(value)} tick={{ fill: "#8491a1", fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltipContent valueFormatter={(value) => money(Number(value ?? 0))} />} cursor={{ fill: "#ffffff0a" }} />
                  <Bar dataKey="month1" name="First month" fill="var(--color-month1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="month2" name="Second month" fill="var(--color-month2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className={styles.chartEmpty}>{loading ? "Loading your category comparison…" : "No category spending found for these months."}</div>
            )}
          </div>
          <p className={styles.chartNote}>Showing up to 8 categories with the highest combined spending.</p>
        </Card>

        <Card className={styles.panel}>
          <PanelHeading title="Category comparison" subtitle="The biggest category changes" icon="categories" />
          <div className={styles.categoryList}>
            {changedCategories.length ? changedCategories.map((item) => {
              const scale = Math.max(item.month1, item.month2, 1);
              const positiveChange = item.change > 0;
              return (
                <div className={styles.categoryRow} key={item.category}>
                  <div className={styles.categoryTopline}>
                    <strong title={item.category}>{item.category}</strong>
              <Badge
                variant={positiveChange ? "danger" : item.change < 0 ? "success" : "default"}
                className={styles.changeBadge + " " + (positiveChange ? styles.changeUpBadge : item.change < 0 ? styles.changeDownBadge : styles.changeFlatBadge)}
              >
                      {item.change > 0 ? "+" : ""}{item.changePercent.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className={styles.pairedBars}>
                    <span className={styles.barTrack}><i className={styles.barFirst} style={{ width: Math.max(item.month1 ? 5 : 0, (item.month1 / scale) * 100) + "%" }} /></span>
                    <span className={styles.barValue}>{money(item.month1)}</span>
                  </div>
                  <div className={styles.pairedBars}>
                    <span className={styles.barTrack}><i className={styles.barSecond} style={{ width: Math.max(item.month2 ? 5 : 0, (item.month2 / scale) * 100) + "%" }} /></span>
                    <span className={styles.barValue}>{money(item.month2)}</span>
                  </div>
                </div>
              );
            }) : <p className={styles.emptyState}>{loading ? "Loading category changes…" : "There are no category changes to show yet."}</p>}
          </div>
          <div className={styles.categoryLegend}>
            <span><i className={styles.legendFirst} />{month1Label}</span>
            <span><i className={styles.legendSecond} />{month2Label}</span>
          </div>
        </Card>

        <Card className={styles.insightPanel}>
          <div className={styles.insightHeader}>
            <span className={styles.insightIcon}><DashboardIcon name="trend" size={17} /></span>
            <span>BIGGEST CHANGE</span>
          </div>
          {biggestChange ? (
            <>
              <p className={styles.insightCategory}>{biggestChange.category}</p>
              <strong className={biggestChange.change > 0 ? styles.insightIncrease : styles.insightSaving}>
                {biggestChange.change > 0 ? "+" : "−"}{money(Math.abs(biggestChange.change))}
              </strong>
              <p className={styles.insightDescription}>
                {biggestChange.change > 0 ? "More spent" : "Less spent"} in {biggestChange.category} during {month2Label}.
              </p>
              <div className={styles.miniCompare}>
                <div><span>{month1Label}</span><strong>{money(biggestChange.month1)}</strong></div>
                <svg viewBox="0 0 100 38" role="img" aria-label={"Spending moved from " + money(biggestChange.month1) + " to " + money(biggestChange.month2)}>
                  <path
                    d={biggestChange.change > 0 ? "M3 31 C 32 31, 66 7, 97 7" : "M3 7 C 32 7, 66 31, 97 31"}
                    className={biggestChange.change > 0 ? styles.miniLineUp : styles.miniLineDown}
                  />
                  <circle cx="3" cy={biggestChange.change > 0 ? "31" : "7"} r="3" className={styles.miniDotStart} />
                  <circle cx="97" cy={biggestChange.change > 0 ? "7" : "31"} r="3" className={styles.miniDotEnd} />
                </svg>
                <div><span>{month2Label}</span><strong>{money(biggestChange.month2)}</strong></div>
              </div>
              <div className={styles.quickTip}>
                <DashboardIcon name="lightbulb" size={17} />
                <p><strong>Quick tip</strong><span>{biggestChange.change > 0 ? "Review recent " + biggestChange.category.toLowerCase() + " purchases to see what drove the increase." : "That’s a helpful drop. Keep the habits that made it possible."}</span></p>
              </div>
            </>
          ) : (
            <div className={styles.insightEmpty}>{loading ? "Finding your biggest change…" : "Once both months have activity, your biggest change will appear here."}</div>
          )}
        </Card>
      </section>

      <Card className={styles.detailPanel}>
        <PanelHeading title="Detailed comparison" subtitle="A category-by-category breakdown of your spending" icon="transactions" />
        <div className={styles.tableScroll}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">{month1Label}</th>
                <th scope="col">{month2Label}</th>
                <th scope="col">Change</th>
                <th scope="col">% change</th>
                <th scope="col">Trend</th>
              </tr>
            </thead>
            <tbody>
              {comparison?.comparison.length ? comparison.comparison.map((item) => (
                <tr key={item.category}>
                  <th scope="row">{item.category}</th>
                  <td>{money(item.month1)}</td>
                  <td>{money(item.month2)}</td>
                  <td className={item.change > 0 ? styles.tableIncrease : item.change < 0 ? styles.tableDecrease : ""}>
                    {item.change > 0 ? "+" : item.change < 0 ? "−" : ""}{money(Math.abs(item.change))}
                  </td>
                  <td>
                    <Badge
                      variant={item.change > 0 ? "danger" : item.change < 0 ? "success" : "default"}
                      className={styles.tableBadge + " " + (item.change > 0 ? styles.changeUpBadge : item.change < 0 ? styles.changeDownBadge : styles.changeFlatBadge)}
                    >
                      {item.change > 0 ? "+" : ""}{item.changePercent.toFixed(1)}%
                    </Badge>
                  </td>
                  <td><TrendMark change={item.change} /></td>
                </tr>
              )) : (
                <tr><td className={styles.tableEmpty} colSpan={6}>{loading ? "Loading detailed comparison…" : "No spending categories are available for these months."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter}>
          <span>{comparison?.comparison.length ?? 0} categories</span>
          <span><i className={styles.legendFirst} />{month1Label}<i className={styles.legendSecond} />{month2Label}</span>
        </div>
      </Card>
    </main>
  );
}

function PanelHeading({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: "reports" | "categories" | "transactions";
}) {
  return (
    <div className={styles.panelHeading}>
      <span className={styles.panelHeadingIcon}><DashboardIcon name={icon} size={17} /></span>
      <div><h2>{title}</h2><p>{subtitle}</p></div>
    </div>
  );
}

function TrendMark({ change }: { change: number }) {
  const isIncrease = change > 0;
  const isDecrease = change < 0;
  return (
    <span className={styles.trendMark + " " + (isIncrease ? styles.tableIncrease : isDecrease ? styles.tableDecrease : "")}>
      <DashboardIcon name={isDecrease ? "trend" : isIncrease ? "trend" : "arrows"} size={15} />
      {isIncrease ? "Up" : isDecrease ? "Down" : "Even"}
    </span>
  );
}
