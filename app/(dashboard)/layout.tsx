import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import NotificationBell from "@/components/notification-bell";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { DashboardIcon } from "@/components/dashboard-icon";
import Link from "next/link";
import styles from "./layout.module.css";

const mobileNavigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Imports", href: "/imports" },
  { name: "Transactions", href: "/transactions" },
  { name: "Search", href: "/search" },
  { name: "Reports", href: "report" },
  { name: "Compare", href: "/compare" },
  { name: "Rules", href: "/settings/rules" },
  { name: "Categories", href: "/settings/categories" },
  { name: "Merchants", href: "/settings/merchants" },
  { name: "Notifications", href: "/settings/notifications" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const currentMonth = format(now, "MMMM yyyy");
  const reportHref = `/reports/${now.getFullYear()}/${now.getMonth() + 1}`;
  const initials = session.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={styles.shell} data-app-shell="true">
      <DashboardSidebar reportHref={reportHref} />
      <header className={styles.topbar}>
        <div className={styles.monthLabel}>
          <DashboardIcon name="calendar" size={19} />
          <span>{currentMonth}</span>
        </div>

        <div className={styles.topbarActions}>
          <div className={styles.emailLabel}>
            <DashboardIcon name="user" size={17} />
            <span>{session.email}</span>
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <NotificationBell />
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.identity}>
            <span className={styles.avatar}>{initials}</span>
            <span className={styles.identityName}>{session.name}</span>
          </div>
          <form action="/api/auth/logout" method="POST" className={styles.mobileSignOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <nav aria-label="Product navigation" className={styles.mobileNavigation}>
        {mobileNavigation.map((item) => (
          <Link key={item.name} href={item.href === "report" ? reportHref : item.href}>
            {item.name}
          </Link>
        ))}
      </nav>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
