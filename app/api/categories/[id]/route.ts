import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryPatchSchema, isPrismaUniqueConstraintError } from "@/lib/validations/finance";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = categoryPatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: parsed.success ? "No changes provided" : parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const category = await prisma.category.findFirst({ where: { id, userId: session.id } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  try {
    const updated = await prisma.category.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
    }
    console.error("Category update failed:", error);
    return NextResponse.json({ error: "Could not update category" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });

  const category = await prisma.category.findFirst({ where: { id, userId: session.id } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  if (category.isSystem) return NextResponse.json({ error: "Default categories cannot be deleted" }, { status: 409 });

  const transactionCount = await prisma.transaction.count({ where: { userId: session.id, categoryId: id } });
  if (transactionCount > 0) {
    return NextResponse.json({ error: "Move this category's transactions before deleting it" }, { status: 409 });
  }
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
