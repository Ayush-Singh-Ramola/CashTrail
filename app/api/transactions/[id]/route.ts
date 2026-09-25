import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transactionPatchSchema } from "@/lib/validations/finance";

type Context = { params: Promise<{ id: string }> };

async function readOwnedTransaction(id: number, userId: number) {
  return prisma.transaction.findFirst({ where: { id, userId } });
}

export async function GET(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.id },
    include: { category: true, merchant: true, import: { select: { fileName: true, createdAt: true } } },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  return NextResponse.json(transaction);
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = transactionPatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: parsed.success ? "No changes provided" : parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (!(await readOwnedTransaction(id, session.id))) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const { categoryId, merchantId, transactionDate, ...fields } = parsed.data;
  if (categoryId !== undefined && categoryId !== null) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: session.id }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }
  if (merchantId !== undefined && merchantId !== null) {
    const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, userId: session.id }, select: { id: true } });
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 400 });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...fields,
      categoryId,
      merchantId,
      transactionDate: transactionDate ? new Date(transactionDate) : undefined,
    },
    include: { category: true, merchant: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  const transaction = await readOwnedTransaction(id, session.id);
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
