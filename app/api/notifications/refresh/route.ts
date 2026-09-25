import { format, startOfMonth, endOfMonth } from "date-fns";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPatternsForReport } from "@/lib/analytics/patterns";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await consumeRateLimit(`notifications-refresh:user:${session.id}`, 10, 60 * 60 * 1000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthKey = format(now, "yyyy-MM");
  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.id },
    create: { userId: session.id },
    update: {},
  });
  const pending = [];

  if (preferences.monthlyReminderEnabled && now.getDate() >= preferences.reminderDay) {
    const importedThisMonth = await prisma.import.count({
      where: { userId: session.id, createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) }, status: "COMPLETED" },
    });
    if (importedThisMonth === 0) {
      pending.push({
        userId: session.id,
        type: "MONTHLY_REMINDER" as const,
        title: "Your monthly statement reminder",
        message: "Import this month’s statement when it is ready to see your updated report.",
        href: "/imports",
        dedupeKey: `monthly-reminder:${monthKey}`,
      });
    }
  }

  if (preferences.recurringPaymentEnabled) {
    const patterns = await getPatternsForReport(session.id, currentYear, currentMonth);
    for (const [index, pattern] of patterns.filter((item) => item.type === "recurring_payment").slice(0, 10).entries()) {
      const merchantId = typeof pattern.details?.merchantId === "number" ? pattern.details.merchantId : index;
      pending.push({
        userId: session.id,
        type: "RECURRING_PAYMENT" as const,
        title: "A possible recurring payment was detected",
        message: pattern.description,
        href: `/reports/${currentYear}/${currentMonth}`,
        dedupeKey: `recurring:${monthKey}:${merchantId}`,
      });
    }
  }

  if (pending.length > 0) await prisma.notification.createMany({ data: pending, skipDuplicates: true });
  return NextResponse.json({ refreshed: true });
}
