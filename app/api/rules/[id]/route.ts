import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spendingRulePatchSchema } from "@/lib/validations/finance";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid rule id" }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = spendingRulePatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "No changes provided" }, { status: 400 });

  const rule = await prisma.spendingRule.findFirst({ where: { id, userId: session.id } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  const merchantId = parsed.data.merchantId;
  const categoryId = parsed.data.categoryId;
  const [merchant, category] = await Promise.all([
    merchantId ? prisma.merchant.findFirst({ where: { id: merchantId, userId: session.id }, select: { id: true } }) : null,
    categoryId ? prisma.category.findFirst({ where: { id: categoryId, userId: session.id }, select: { id: true } }) : null,
  ]);
  if (merchantId && !merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 400 });
  if (categoryId && !category) return NextResponse.json({ error: "Category not found" }, { status: 400 });

  const updated = await prisma.spendingRule.update({
    where: { id },
    data: {
      ...parsed.data,
      merchantId: parsed.data.merchantId,
      categoryId: parsed.data.categoryId,
      classification: parsed.data.classification,
    },
    include: { merchant: { select: { name: true } }, category: { select: { name: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid rule id" }, { status: 400 });
  const result = await prisma.spendingRule.deleteMany({ where: { id, userId: session.id } });
  if (result.count === 0) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
