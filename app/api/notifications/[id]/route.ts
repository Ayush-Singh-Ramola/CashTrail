import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  const result = await prisma.notification.updateMany({
    where: { id, userId: session.id },
    data: { readAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  return NextResponse.json({ read: true });
}
