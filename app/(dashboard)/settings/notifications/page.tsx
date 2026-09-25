"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface NotificationItem { id: number; title: string; message: string; href: string | null; readAt: string | null; createdAt: string; type: string }
interface Preferences { monthlyReminderEnabled: boolean; reportReadyEnabled: boolean; recurringPaymentEnabled: boolean; reminderDay: number }

const defaults: Preferences = { monthlyReminderEnabled: true, reportReadyEnabled: true, recurringPaymentEnabled: false, reminderDay: 25 };

export default function NotificationSettingsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) throw new Error("Could not load notifications");
    const data = await response.json();
    setNotifications(data.notifications);
  }, []);

  const load = useCallback(async () => {
    try {
      const [prefResponse] = await Promise.all([
        fetch("/api/notifications/preferences"),
        fetch("/api/notifications/refresh", { method: "POST" }),
      ]);
      if (!prefResponse.ok) throw new Error("Could not load notification settings");
      setPreferences(await prefResponse.json());
      await loadNotifications();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load notifications");
    } finally { setLoading(false); }
  }, [loadNotifications]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const save = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save settings");
      setPreferences(data); setSaved(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save settings"); }
    finally { setSaving(false); }
  };

  const markRead = async (notification: NotificationItem) => {
    if (notification.readAt) return;
    const response = await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
    if (!response.ok) return;
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header><h1 className="text-3xl font-bold text-gray-900">Notifications</h1><p className="mt-1 text-gray-500">In-app reminders and report updates for your account.</p></header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Notification preferences</h2>
        <label className="flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={preferences.monthlyReminderEnabled} onChange={(event) => setPreferences({ ...preferences, monthlyReminderEnabled: event.target.checked })} /><span>Monthly statement reminder</span></label>
        <label className="flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={preferences.reportReadyEnabled} onChange={(event) => setPreferences({ ...preferences, reportReadyEnabled: event.target.checked })} /><span>Report ready after a successful import</span></label>
        <label className="flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={preferences.recurringPaymentEnabled} onChange={(event) => setPreferences({ ...preferences, recurringPaymentEnabled: event.target.checked })} /><span>Possible recurring payment notices</span></label>
        <label className="block max-w-xs text-sm text-gray-700">Reminder day of each month<input type="number" min={1} max={28} value={preferences.reminderDay} onChange={(event) => setPreferences({ ...preferences, reminderDay: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        <p className="text-xs text-gray-500">Notifications appear here when you open the app. No email or push messages are sent.</p>
        <button onClick={() => void save()} disabled={saving || loading} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save preferences"}</button>
        {saved && <span role="status" className="ml-3 text-sm text-emerald-800">Saved</span>}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 p-5 font-semibold text-gray-900">Recent notifications</h2>
        {loading ? <p className="p-6 text-sm text-gray-500">Loading…</p> : notifications.length === 0 ? <p className="p-6 text-sm text-gray-500">You’re all caught up. New import and reminder updates will appear here.</p> : (
          <ul className="divide-y divide-gray-100">{notifications.map((notification) => <li key={notification.id} className={`p-4 ${notification.readAt ? "" : "bg-emerald-50/50"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{notification.title}</p><p className="mt-1 text-sm leading-5 text-gray-600">{notification.message}</p><p className="mt-2 text-xs text-gray-400">{new Date(notification.createdAt).toLocaleString("en-IN")}</p></div>{!notification.readAt && <button onClick={() => void markRead(notification)} className="shrink-0 text-xs font-medium text-emerald-800 hover:underline">Mark read</button>}</div>{notification.href && <Link href={notification.href} onClick={() => void markRead(notification)} className="mt-3 inline-block text-sm font-medium text-emerald-800 hover:underline">Open</Link>}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
