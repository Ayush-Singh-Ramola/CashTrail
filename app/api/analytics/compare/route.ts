import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMonthlyComparison } from "@/lib/analytics/report";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const y1 = parseInt(searchParams.get("y1") || "0");
  const m1 = parseInt(searchParams.get("m1") || "0");
  const y2 = parseInt(searchParams.get("y2") || "0");
  const m2 = parseInt(searchParams.get("m2") || "0");

  if (!y1 || !m1 || !y2 || !m2) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const comparison = await getMonthlyComparison(session.id, y1, m1, y2, m2);

  return NextResponse.json(comparison);
}