"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, type DashboardIconName } from "@/components/dashboard-icon";
import styles from "@/components/dashboard-sidebar.module.css";

const navigation: { name: string; href: string; icon: DashboardIconName }[] = [
  { name: "Dashboard", href: "/dashboard", icon: "home" },
  { name: "Imports", href: "/imports", icon: "import" },
  { name: "Transactions", href: "/transactions", icon: "transactions" },
  { name: "Search", href: "/search", icon: "search" },
  { name: "Reports", href: "/reports", icon: "reports" },
  { name: "Compare", href: "/compare", icon: "compare" },
  { name: "Rules", href: "/settings/rules", icon: "rules" },
  { name: "Categories", href: "/settings/categories", icon: "categories" },
  { name: "Merchants", href: "/settings/merchants", icon: "merchants" },
  { name: "Notifications", href: "/settings/notifications", icon: "notifications" },
];

export default function DashboardSidebar({ reportHref }: { reportHref: string }) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <Link href="/dashboard" className={styles.brand} aria-label="Money Autopsy dashboard">
        <span className={styles.brandMark} aria-hidden="true"><i /><i /></span>
        <span className={styles.brandCopy}>
          <strong>Money Autopsy</strong>
          <small>Know Your Money</small>
        </span>
      </Link>

      <nav aria-label="Product navigation" className={styles.navigation}>
        {navigation.map((item) => {
          const href = item.name === "Reports" ? reportHref : item.href;
          const active = item.name === "Reports"
            ? pathname.startsWith("/reports")
            : item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={href}
              className={`${styles.navLink}${active ? ` ${styles.active}` : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <DashboardIcon name={item.icon} size={19} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarBottom}>
        <div className={styles.sidebarNote}>
          <span className={styles.noteMark} aria-hidden="true">✦</span>
          <p>Better decisions.<br />Healthier finances.</p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className={styles.signOut}>Sign out</button>
        </form>
      </div>
    </aside>
  );
}
