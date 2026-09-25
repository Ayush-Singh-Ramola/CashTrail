import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPatternsForReport } from "@/lib/analytics/patterns";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const patterns = await getPatternsForReport(session.id, year, month);
  const recurringPayments = patterns.filter((pattern) => pattern.type === "recurring_payment");
  return NextResponse.json({ recurringPayments });
}
