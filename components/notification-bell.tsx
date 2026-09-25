"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardIcon } from "@/components/dashboard-icon";
import styles from "@/components/notification-bell.module.css";

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      try {
        await fetch("/api/notifications/refresh", { method: "POST" });
        const response = await fetch("/api/notifications");
        if (response.ok) setUnread((await response.json()).unreadCount);
      } catch {
        // The dashboard remains usable if notifications are temporarily unavailable.
      }
    };
    void refresh();
  }, []);

  return (
    <Link href="/settings/notifications" className={styles.link} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} title="Notifications">
      <DashboardIcon name="notifications" size={18} />
      {unread > 0 && <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
