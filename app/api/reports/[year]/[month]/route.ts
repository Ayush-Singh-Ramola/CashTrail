import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateReport } from "@/lib/analytics/report";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { year, month } = await params;
  const yearNum = parseInt(year);
  const monthNum = parseInt(month);

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const report = await generateReport(session.id, yearNum, monthNum);

  return NextResponse.json(report);
}