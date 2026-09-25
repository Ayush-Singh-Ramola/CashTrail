import type { ReactNode } from "react";

export type DashboardIconName =
  | "home"
  | "import"
  | "transactions"
  | "search"
  | "reports"
  | "compare"
  | "rules"
  | "categories"
  | "merchants"
  | "notifications"
  | "calendar"
  | "wallet"
  | "arrows"
  | "shield"
  | "food"
  | "trend"
  | "alert"
  | "lightbulb"
  | "clock"
  | "arrowRight"
  | "chevron"
  | "user";

const iconPaths: Record<DashboardIconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  import: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  transactions: <><path d="M4 7h15l-3-3" /><path d="M20 17H5l3 3" /><path d="M19 7 16 4M5 17l3 3" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
  reports: <><path d="M4 20V11h4v9M10 20V4h4v16M16 20v-7h4v7" /></>,
  compare: <><path d="M4 7h16M7 4 4 7l3 3M17 14l3 3-3 3M20 17H4" /><path d="M8 14h8" /></>,
  rules: <><path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  categories: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  merchants: <><path d="M4 10h16l-1.5-6h-13L4 10Z" /><path d="M5 10v10h14V10M9 20v-6h6v6" /><path d="M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></>,
  notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h2" /></>,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6a3 3 0 0 1-3-3V7a.5.5 0 0 1 1 0v10" /><path d="M20 9h-5a3 3 0 0 0 0 6h5M15 12h.01" /></>,
  arrows: <><path d="M4 7h15l-3-3M20 17H5l3 3" /><path d="m19 7-3-3M5 17l3 3" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" /><path d="M12 7v10" /></>,
  food: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c-3 3-3 8 0 9h3V3" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
  alert: <><path d="m10.3 4.4-8 14A1.8 1.8 0 0 0 3.9 21h16.2a1.8 1.8 0 0 0 1.6-2.6l-8-14a1.9 1.9 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  lightbulb: <><path d="M9 18h6M10 22h4M8.2 14.8a7 7 0 1 1 7.6 0c-.9.6-1.3 1.4-1.5 2.2h-4.6c-.2-.8-.6-1.6-1.5-2.2Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  arrowRight: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  chevron: <><path d="m7 10 5 5 5-5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

export function DashboardIcon({
  name,
  size = 20,
  strokeWidth = 1.8,
}: {
  name: DashboardIconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}
