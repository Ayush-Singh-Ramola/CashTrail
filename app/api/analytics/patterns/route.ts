import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPatternsForReport } from "@/lib/analytics/patterns";

function readMonth(request: Request): { year: number; month: number } | null {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selectedMonth = readMonth(request);
  if (!selectedMonth) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const patterns = await getPatternsForReport(session.id, selectedMonth.year, selectedMonth.month);

  return NextResponse.json({ patterns });
}
