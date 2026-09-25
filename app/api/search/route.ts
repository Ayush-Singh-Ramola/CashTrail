import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { parseNaturalLanguageQuery } from "@/lib/search/natural-language";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await consumeRateLimit(`search:user:${session.id}`, 60, 60 * 1000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 200) {
    return NextResponse.json({ error: query ? "Search query is too long" : "Enter a search query" }, { status: 400 });
  }

  const [categories, merchants] = await Promise.all([
    prisma.category.findMany({ where: { userId: session.id }, select: { id: true, name: true } }),
    prisma.merchant.findMany({ where: { userId: session.id }, select: { id: true, name: true } }),
  ]);
  const parsed = parseNaturalLanguageQuery(query, categories, merchants);
  const where: Prisma.TransactionWhereInput = { userId: session.id };
  if (parsed.type) where.type = parsed.type;
  if (parsed.categoryId) where.categoryId = parsed.categoryId;
  if (parsed.merchantId) where.merchantId = parsed.merchantId;
  if (parsed.minAmount !== undefined || parsed.maxAmount !== undefined) {
    where.amount = {
      ...(parsed.minAmount !== undefined ? { gte: parsed.minAmount } : {}),
      ...(parsed.maxAmount !== undefined ? { lte: parsed.maxAmount } : {}),
    };
  }
  if (parsed.startDate && parsed.endDate) {
    where.transactionDate = { gte: parsed.startDate, lte: parsed.endDate };
  }
  if (parsed.text) {
    where.OR = [
      { description: { contains: parsed.text, mode: "insensitive" } },
      { normalizedDesc: { contains: parsed.text, mode: "insensitive" } },
      { merchant: { is: { name: { contains: parsed.text, mode: "insensitive" } } } },
      { category: { is: { name: { contains: parsed.text, mode: "insensitive" } } } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: { select: { id: true, name: true, color: true } }, merchant: { select: { id: true, name: true } } },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: 50,
    }),
    prisma.transaction.count({ where }),
  ]);
  return NextResponse.json({ query, interpretation: parsed.description, total, transactions });
}
