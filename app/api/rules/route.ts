import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spendingRuleInputSchema } from "@/lib/validations/finance";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rules = await prisma.spendingRule.findMany({
    where: { userId: session.id },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    include: { merchant: { select: { name: true } }, category: { select: { name: true } } },
  });
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = spendingRuleInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const [merchant, category] = await Promise.all([
    parsed.data.merchantId ? prisma.merchant.findFirst({ where: { id: parsed.data.merchantId, userId: session.id }, select: { id: true } }) : null,
    parsed.data.categoryId ? prisma.category.findFirst({ where: { id: parsed.data.categoryId, userId: session.id }, select: { id: true } }) : null,
  ]);
  if (parsed.data.merchantId && !merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 400 });
  if (parsed.data.categoryId && !category) return NextResponse.json({ error: "Category not found" }, { status: 400 });

  const rule = await prisma.spendingRule.create({
    data: {
      userId: session.id,
      pattern: parsed.data.pattern,
      merchantId: parsed.data.merchantId ?? null,
      categoryId: parsed.data.categoryId ?? null,
      classification: parsed.data.classification ?? null,
      priority: parsed.data.priority,
    },
    include: { merchant: { select: { name: true } }, category: { select: { name: true } } },
  });
  return NextResponse.json(rule, { status: 201 });
}
