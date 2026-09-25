import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryInputSchema, isPrismaUniqueConstraintError } from "@/lib/validations/finance";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { userId: session.id },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = categoryInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const category = await prisma.category.create({
      data: { ...parsed.data, userId: session.id, isSystem: false },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
    }
    console.error("Category creation failed:", error);
    return NextResponse.json({ error: "Could not create category" }, { status: 500 });
  }
}
