import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const merchants = await prisma.merchant.findMany({
    where: { userId: session.id },
    orderBy: { name: "asc" },
    include: { defaultCategory: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json(merchants);
}
