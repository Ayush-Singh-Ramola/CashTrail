import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown-client";
}

export async function consumeRateLimit(
  key: string,
  maximumAttempts: number,
  windowMs: number,
  now = new Date()
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const secret = process.env.AUTH_SECRET || "development-rate-limit-key";
  const digest = createHmac("sha256", secret).update(key).digest("hex");
  const windowStart = new Date(now.getTime() - windowMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key: digest },
    create: { key: digest, windowStartedAt: now, attempts: 1 },
    update: { attempts: { increment: 1 } },
    select: { attempts: true, windowStartedAt: true },
  });

  if (bucket.windowStartedAt <= windowStart) {
    await prisma.rateLimitBucket.updateMany({
      where: { key: digest, windowStartedAt: bucket.windowStartedAt },
      data: { attempts: 1, windowStartedAt: now },
    });
  }

  const current = await prisma.rateLimitBucket.findUnique({
    where: { key: digest },
    select: { attempts: true, windowStartedAt: true },
  });
  if (!current) throw new Error("Rate limit bucket disappeared");
  const retryAfterSeconds = Math.max(1, Math.ceil((current.windowStartedAt.getTime() + windowMs - now.getTime()) / 1000));
  return {
    allowed: current.attempts <= maximumAttempts,
    remaining: Math.max(0, maximumAttempts - current.attempts),
    retryAfterSeconds,
  };
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many requests. Please wait before trying again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
