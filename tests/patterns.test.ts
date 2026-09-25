import assert from "node:assert/strict";
import test from "node:test";

let patternsModule: Promise<typeof import("../lib/analytics/patterns")> | undefined;
async function getPatternsModule() {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test?schema=public";
  patternsModule ??= import("../lib/analytics/patterns");
  return patternsModule;
}

const date = (value: string) => new Date(`${value}T12:00:00.000Z`);

test("patterns report small purchases, late-night spending, weekends, and repeated merchants", async () => {
  const { detectPatternsFromTransactions } = await getPatternsModule();
  const current = [
    { id: 1, amount: 199, transactionDate: date("2026-09-04"), transactionTime: new Date(2026, 8, 4, 22, 30), merchantId: 1, merchant: { name: "Corner Cafe" } },
    { id: 2, amount: 200, transactionDate: date("2026-09-05"), transactionTime: null, merchantId: 1, merchant: { name: "Corner Cafe" } },
    { id: 3, amount: 350, transactionDate: date("2026-09-06"), transactionTime: null, merchantId: 1, merchant: { name: "Corner Cafe" } },
  ];
  const patterns = detectPatternsFromTransactions(current, current);
  const byType = new Map(patterns.map((pattern) => [pattern.type, pattern]));
  assert.equal(byType.get("small_purchases")?.count, 1);
  assert.equal(byType.get("small_purchases")?.totalAmount, 199);
  assert.equal(byType.get("late_night")?.count, 1);
  assert.equal(byType.get("weekend")?.count, 2);
  assert.equal(byType.get("repeated_merchant")?.count, 3);
  assert.equal(byType.get("repeated_merchant")?.totalAmount, 749);
});

test("recurring payments need similar amounts and dates across months", async () => {
  const { detectPatternsFromTransactions } = await getPatternsModule();
  const current = [
    { id: 1, amount: 119, transactionDate: date("2026-09-10"), transactionTime: null, merchantId: 5, merchant: { name: "Stream Service" } },
  ];
  const history = [
    ...current,
    { id: 2, amount: 121, transactionDate: date("2026-08-11"), transactionTime: null, merchantId: 5, merchant: { name: "Stream Service" } },
    { id: 3, amount: 119, transactionDate: date("2026-07-09"), transactionTime: null, merchantId: 5, merchant: { name: "Stream Service" } },
  ];
  const patterns = detectPatternsFromTransactions(current, history);
  const recurring = patterns.find((pattern) => pattern.type === "recurring_payment");
  assert.ok(recurring);
  assert.equal(recurring.count, 1);
  assert.equal(recurring.totalAmount, 119);
  assert.equal(recurring.details?.monthsDetected, 3);
  assert.equal(recurring.details?.confidence, 0.95);
});

test("recurring suggestions do not claim certainty or count unrelated amounts", async () => {
  const { detectPatternsFromTransactions } = await getPatternsModule();
  const current = [
    { id: 1, amount: 99, transactionDate: date("2026-09-10"), transactionTime: null, merchantId: 5, merchant: { name: "Store" } },
  ];
  const history = [
    ...current,
    { id: 2, amount: 200, transactionDate: date("2026-08-10"), transactionTime: null, merchantId: 5, merchant: { name: "Store" } },
  ];
  assert.equal(detectPatternsFromTransactions(current, history).some((pattern) => pattern.type === "recurring_payment"), false);
});

test("late-night patterns include times strictly after 10 PM", async () => {
  const { detectPatternsFromTransactions } = await getPatternsModule();
  const transactions = [
    { id: 1, amount: 300, transactionDate: date("2026-09-08"), transactionTime: new Date(2026, 8, 8, 22, 0), merchantId: null },
    { id: 2, amount: 350, transactionDate: date("2026-09-08"), transactionTime: new Date(2026, 8, 8, 22, 1), merchantId: null },
  ];
  const lateNight = detectPatternsFromTransactions(transactions, transactions).find((pattern) => pattern.type === "late_night");
  assert.equal(lateNight?.count, 1);
  assert.equal(lateNight?.totalAmount, 350);
});
