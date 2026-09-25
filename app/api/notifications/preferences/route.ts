import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const preferencePatchSchema = z.object({
  monthlyReminderEnabled: z.boolean().optional(),
  reportReadyEnabled: z.boolean().optional(),
  recurringPaymentEnabled: z.boolean().optional(),
  reminderDay: z.number().int().min(1).max(28).optional(),
}).strict();

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.id },
    create: { userId: session.id },
    update: {},
  });
  return NextResponse.json(preferences);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = preferencePatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "No preference changes provided" }, { status: 400 });

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.id },
    create: { userId: session.id, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json(preferences);
}
