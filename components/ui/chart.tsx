"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { TooltipContentProps, TooltipValueType } from "recharts";
import { ResponsiveContainer } from "recharts";
import styles from "./chart.module.css";

export type ChartConfig = Record<string, { label: string; color: string }>;

type InjectedTooltipProps = "payload" | "coordinate" | "active" | "accessibilityLayer" | "activeIndex";
type ChartTooltipContentProps = Omit<TooltipContentProps, InjectedTooltipProps>
  & Partial<Pick<TooltipContentProps, InjectedTooltipProps>>
  & { valueFormatter?: (value: TooltipValueType | undefined) => ReactNode };

const ChartConfigContext = createContext<ChartConfig>({});

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: ReactNode;
}) {
  const colors = Object.fromEntries(
    Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]),
  ) as CSSProperties;

  return (
    <ChartConfigContext.Provider value={config}>
      <div className={[styles.chartContainer, className].filter(Boolean).join(" ")} style={colors} data-ui="chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      </div>
    </ChartConfigContext.Provider>
  );
}

export function ChartTooltipContent({
  active,
  label,
  labelFormatter,
  payload,
  valueFormatter,
}: ChartTooltipContentProps) {
  const config = useContext(ChartConfigContext);

  if (!active || !payload?.length) return null;

  const heading = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div className={styles.tooltip}>
      {heading !== undefined && <p className={styles.tooltipLabel}>{heading}</p>}
      <div className={styles.tooltipItems}>
        {payload.filter((item) => !item.hide).map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const series = config[key];
          const displayName = series?.label ?? String(item.name ?? key);
          const displayValue = valueFormatter ? valueFormatter(item.value) : item.value;

          return (
            <div className={styles.tooltipItem} key={key}>
              <span className={styles.tooltipSeries} style={{ backgroundColor: series?.color ?? item.color }} />
              <span>{displayName}</span>
              <strong>{displayValue}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
