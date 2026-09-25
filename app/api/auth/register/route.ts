import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";
import { clientAddress, consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await consumeRateLimit(`auth:register:${clientAddress(request.headers)}`, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;

    const passwordHash = await hashPassword(password);

    // Create default categories
    const defaultCategories = [
      { name: "Food", icon: "🍔", color: "#EF4444", type: "EXPENSE" as const, classification: "DISCRETIONARY" as const, isSystem: true },
      { name: "Shopping", icon: "🛍️", color: "#F59E0B", type: "EXPENSE" as const, classification: "DISCRETIONARY" as const, isSystem: true },
      { name: "Travel", icon: "🚗", color: "#3B82F6", type: "EXPENSE" as const, classification: "ESSENTIAL" as const, isSystem: true },
      { name: "Entertainment", icon: "🎮", color: "#8B5CF6", type: "EXPENSE" as const, classification: "DISCRETIONARY" as const, isSystem: true },
      { name: "Subscriptions", icon: "📱", color: "#06B6D4", type: "EXPENSE" as const, classification: "USEFUL" as const, isSystem: true },
      { name: "Bills", icon: "📄", color: "#64748B", type: "EXPENSE" as const, classification: "ESSENTIAL" as const, isSystem: true },
      { name: "Education", icon: "📚", color: "#10B981", type: "EXPENSE" as const, classification: "USEFUL" as const, isSystem: true },
      { name: "Health", icon: "🏥", color: "#EC4899", type: "EXPENSE" as const, classification: "ESSENTIAL" as const, isSystem: true },
      { name: "Personal", icon: "👤", color: "#F97316", type: "EXPENSE" as const, classification: "DISCRETIONARY" as const, isSystem: true },
      { name: "Cash", icon: "💵", color: "#22C55E", type: "EXPENSE" as const, classification: "CUSTOM" as const, isSystem: true },
      { name: "Other", icon: "📦", color: "#94A3B8", type: "EXPENSE" as const, classification: "CUSTOM" as const, isSystem: true },
      { name: "Income", icon: "💰", color: "#22C55E", type: "INCOME" as const, classification: "ESSENTIAL" as const, isSystem: true },
    ];

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, passwordHash },
      });

      await tx.category.createMany({
        data: defaultCategories.map((category) => ({
          ...category,
          userId: createdUser.id,
        })),
      });

      return createdUser;
    });

    const token = await createToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    console.error("Registration request failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
