import assert from "node:assert/strict";
import test from "node:test";
import { explainReportWithAI } from "../lib/analytics/ai-explanation";
import type { ReportData } from "../lib/analytics/report";

function sampleReport(): ReportData {
  return {
    year: 2026,
    month: 9,
    monthName: "September 2026",
    totalIncome: 25000,
    totalExpense: 18420,
    netSavings: 6580,
    foodDeliveryTotal: 0,
    dailySpend: [],
    recentTransactions: [],
    categoryBreakdown: [{ categoryId: 1, name: "Food", color: null, amount: 500, percentage: 40, transactionCount: 3 }],
    biggestLeaks: [],
    smallPurchases: { count: 1, total: 100, percentage: 1 },
    topMerchants: [],
    expensiveTransactions: [{ id: 1, description: "PRIVATE RAW STATEMENT TEXT", amount: 100, date: new Date(), merchantName: "Private merchant", categoryName: "Food" }],
    patterns: [{ type: "small_purchases", label: "Small purchases", description: "Private detail", count: 1, totalAmount: 100, percentageOfSpending: 1 }],
    recurringPayments: [],
    classificationBreakdown: [{ classification: "ESSENTIAL", amount: 500, count: 3 }],
    monthOverMonth: {
      previousMonthName: "August 2026",
      previousTotal: 2000,
      hasPreviousTransactions: true,
      change: -100,
      changePercent: -5,
      categoryChanges: [{ category: "Food", previousAmount: 600, amount: 500, change: -100 }],
    },
    explanation: "Private server generated explanation",
  };
}

test("AI explanation sends only aggregate facts with provider storage disabled", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ output: [{ content: [{ type: "output_text", text: "Food was the largest spending area, with a modest change from the prior month." }] }] });
  };

  try {
    const explanation = await explainReportWithAI(sampleReport());
    assert.match(explanation, /Food was the largest/);
    assert.equal(requestBody?.store, false);
    const facts = String(requestBody?.input);
    assert.match(facts, /Food/);
    assert.doesNotMatch(facts, /PRIVATE RAW STATEMENT TEXT|Private merchant|Private detail|Private server generated explanation/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test("AI explanation rejects invented amounts and malformed provider output", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";
  globalThis.fetch = async () => Response.json({ output: [{ content: [{ type: "output_text", text: "You spent ₹500 on food." }] }] });

  try {
    await assert.rejects(() => explainReportWithAI(sampleReport()), /safety constraints/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});
