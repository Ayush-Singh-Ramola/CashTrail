import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, createToken, setAuthCookie } from "@/lib/auth";
import { clientAddress, consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await consumeRateLimit(`auth:login:${clientAddress(request.headers)}`, 8, 15 * 60 * 1000);
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.passwordHash.startsWith("pbkdf2$")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(validation.data.password) },
      });
    }

    const token = await createToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch {
    console.error("Login request failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
