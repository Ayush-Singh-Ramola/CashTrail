"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import styles from "./report.module.css";

type DailySpend = { day: number; current: number; previous: number };

const chartConfig = {
  current: { label: "This month", color: "#8de34c" },
  previous: { label: "Last month", color: "#8293a9" },
} satisfies ChartConfig;

const compactMoney = (amount: number) => {
  if (amount >= 1_000_000) return `₹${(amount / 1_000_000).toFixed(1)}m`;
  if (amount >= 10_000) return `₹${Math.round(amount / 1_000)}k`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export default function SpendingOverviewChart({
  data,
  monthName,
  previousMonthName,
  monthAbbreviation,
}: {
  data: DailySpend[];
  monthName: string;
  previousMonthName: string;
  monthAbbreviation: string;
}) {
  const config = {
    ...chartConfig,
    current: { ...chartConfig.current, label: monthName },
    previous: { ...chartConfig.previous, label: previousMonthName },
  } satisfies ChartConfig;
  const hasActivity = data.some((point) => point.current > 0 || point.previous > 0);
  const xAxisInterval = Math.max(0, Math.ceil(data.length / 7) - 1);

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartLegend} aria-hidden="true">
        <span><i className={styles.currentDot} />{monthName}</span>
        <span><i className={styles.previousDot} />{previousMonthName}</span>
      </div>
      <ChartContainer
        config={config}
        className={styles.chart}
      >
        <AreaChart data={data} margin={{ top: 36, right: 12, bottom: 0, left: 4 }} accessibilityLayer aria-label={`Daily expenses in ${monthName} compared with ${previousMonthName}`}>
          <defs>
            <linearGradient id="report-current-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#263442" strokeDasharray="3 5" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={9}
            interval={xAxisInterval}
            tick={{ fill: "#8592a3", fontSize: 9 }}
            tickFormatter={(value: number) => value === 1 ? `${monthAbbreviation} ${value}` : String(value)}
          />
          <YAxis
            width={53}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            tickMargin={7}
            tick={{ fill: "#8592a3", fontSize: 9 }}
            tickFormatter={(value: number) => compactMoney(value)}
          />
          <Tooltip
            cursor={{ stroke: "#64748b", strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => `${monthAbbreviation} ${label}`}
                valueFormatter={(value) => `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="previous"
            stroke="var(--color-previous)"
            strokeWidth={1.8}
            strokeDasharray="5 5"
            fill="none"
            activeDot={{ r: 3, fill: "var(--color-previous)", stroke: "#101720", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="current"
            stroke="var(--color-current)"
            strokeWidth={2.5}
            fill="url(#report-current-fill)"
            activeDot={{ r: 4, fill: "var(--color-current)", stroke: "#101720", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      {!hasActivity && <p className={styles.chartEmpty}>Daily expenses will appear here when this month has activity.</p>}
    </div>
  );
}
