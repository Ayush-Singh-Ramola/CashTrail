import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { explainReportWithAI } from "@/lib/analytics/ai-explanation";
import { generateReport } from "@/lib/analytics/report";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(1).max(12),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await consumeRateLimit(`ai-explanation:user:${session.id}`, 5, 60 * 60 * 1000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    return NextResponse.json({ error: "AI explanations are not configured for this deployment" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Report period and data-sharing consent are required" }, { status: 400 });

  try {
    const report = await generateReport(session.id, parsed.data.year, parsed.data.month);
    const explanation = await explainReportWithAI(report);
    return NextResponse.json({ explanation, provider: "OpenAI" });
  } catch {
    console.error("AI report explanation failed");
    return NextResponse.json({ error: "An explanation could not be generated right now" }, { status: 502 });
  }
}
