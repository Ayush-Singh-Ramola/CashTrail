import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueConstraintError, merchantPatchSchema } from "@/lib/validations/finance";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid merchant id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = merchantPatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: parsed.success ? "No changes provided" : parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const merchant = await prisma.merchant.findFirst({ where: { id, userId: session.id } });
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

  if (parsed.data.defaultCategoryId !== undefined && parsed.data.defaultCategoryId !== null) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.defaultCategoryId, userId: session.id },
      select: { id: true },
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  try {
    const updated = await prisma.merchant.update({
      where: { id },
      data: {
        ...parsed.data,
        rawPatterns: parsed.data.rawPatterns
          ? Array.from(new Set(parsed.data.rawPatterns.map((pattern) => pattern.trim()).filter(Boolean)))
          : undefined,
      },
      include: { defaultCategory: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A merchant with that name already exists" }, { status: 409 });
    }
    console.error("Merchant update failed:", error);
    return NextResponse.json({ error: "Could not update merchant" }, { status: 500 });
  }
}
