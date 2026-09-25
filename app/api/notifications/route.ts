import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: session.id, readAt: null } }),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}
