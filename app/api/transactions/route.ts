import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedPage = Number(searchParams.get("page") || 1);
  const requestedLimit = Number(searchParams.get("limit") || 50);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 50;
  const month = searchParams.get("month");
  const category = searchParams.get("category");
  const merchant = searchParams.get("merchant");
  const type = searchParams.get("type");
  const minAmount = searchParams.get("minAmount");
  const maxAmount = searchParams.get("maxAmount");
  const search = searchParams.get("search");

  const where: Prisma.TransactionWhereInput = { userId: session.id };

  if (month) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) return NextResponse.json({ error: "Month must use YYYY-MM format" }, { status: 400 });
    const [, rawYear, rawMonth] = match;
    const year = Number(rawYear);
    const monthNum = Number(rawMonth);
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0, 23, 59, 59);
    where.transactionDate = { gte: start, lte: end };
  }

  if (category) {
    const id = Number(category);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    where.categoryId = id;
  }
  if (merchant) {
    const id = Number(merchant);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid merchant" }, { status: 400 });
    where.merchantId = id;
  }
  if (type && (type === "INCOME" || type === "EXPENSE" || type === "TRANSFER")) {
    where.type = type as Prisma.TransactionWhereInput["type"];
  }
  if (minAmount || maxAmount) {
    const min = minAmount ? Number(minAmount) : undefined;
    const max = maxAmount ? Number(maxAmount) : undefined;
    if ((min !== undefined && (!Number.isFinite(min) || min < 0)) || (max !== undefined && (!Number.isFinite(max) || max < 0)) ||
      (min !== undefined && max !== undefined && min > max)) {
      return NextResponse.json({ error: "Invalid amount range" }, { status: 400 });
    }
    where.amount = {};
    if (min !== undefined) where.amount.gte = min;
    if (max !== undefined) where.amount.lte = max;
  }
  if (search) {
    if (search.length > 200) return NextResponse.json({ error: "Search is too long" }, { status: 400 });
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { normalizedDesc: { contains: search, mode: "insensitive" } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, merchant: true },
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total });
}
