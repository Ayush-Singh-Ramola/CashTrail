import assert from "node:assert/strict";
import test from "node:test";
import { decodeCSVBytes, parseCSV, parseCSVToRows } from "../lib/parsers/csv";
import { normalizeMerchant, normalizeWithUserMappings } from "../lib/merchants/normalize-core";
import { categorizeTransaction } from "../lib/merchants/categorize";
import { matchesSpendingRule } from "../lib/merchants/rules";
import { parseNaturalLanguageQuery } from "../lib/search/natural-language";
import { categoryInputSchema, spendingRuleInputSchema } from "../lib/validations/finance";
import { summarizeImportTransactions } from "../lib/imports/summary";

test("CSV rows preserve quoted commas, escaped quotes, and quoted newlines", () => {
  assert.deepEqual(parseCSVToRows('date,description\n2026-09-01,"Cafe, \"\"Blue\"\"\nAnd Cafe"'), [
    ["date", "description"],
    ["2026-09-01", 'Cafe, "Blue"\nAnd Cafe'],
  ]);
});

test("CSV parser recognizes expense and income rows and skips failed payments", () => {
  const csv = [
    "Transaction Date,Description,Debit,Credit,Status",
    "2026-09-03 22:15:00,UPI Zomato,150.00,,Success",
    "2026-09-04,Salary,,25000,Success",
    "2026-09-05,Failed payment,800,,Failed",
  ].join("\n");
  const transactions = parseCSV(csv);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].type, "EXPENSE");
  assert.equal(transactions[0].amount, 150);
  assert.equal(transactions[0].time?.getHours(), 22);
  assert.equal(transactions[1].type, "INCOME");
  assert.equal(transactions[1].amount, 25000);
});

test("PhonePe Aug-Sep statement preserves debit/credit types and exact rupee totals", () => {
  const csvRows = ["Transaction Date,Details,Transaction Type,Amount (INR),UTR Number"];
  const transactions = [
    ["2026-08-26", "Received from HASIBUR RAHAMAN", "CREDIT", "₹100", "PP-C-100"],
    ["2026-08-30", "Received from VIJAY KUMAR", "CREDIT", "₹1,500", "PP-C-1500"],
    ["2026-09-11", "Received from ******2414", "CREDIT", "₹40", "PP-C-40"],
    ["2026-09-17", "Received from VIJAY KUMAR", "CREDIT", "₹2,500", "PP-C-2500"],
    ["2026-09-12", "Paid to AYUSH SINGH RAMOLA", "DEBIT", "₹1,500", "PP-D-AYUSH"],
    ["2026-09-13", "Paid to Vijay Kumar", "DEBIT", "₹5", "PP-D-VIJAY"],
  ];

  for (let index = 1; index <= 34; index++) {
    transactions.push([
      `2026-09-${String((index % 24) + 1).padStart(2, "0")}`,
      `PhonePe fixture debit ${String(index).padStart(2, "0")}`,
      "DEBIT",
      "₹50",
      `PP-D-${index}`,
    ]);
  }
  transactions.push(["2026-09-25", "PhonePe fixture debit 35", "DEBIT", "₹663", "PP-D-35"]);

  for (const row of transactions) {
    csvRows.push(row.map((cell) => /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(","));
  }

  const parsed = parseCSV(csvRows.join("\n"));
  const summary = summarizeImportTransactions(parsed);
  assert.deepEqual(summary, {
    transactionCount: 41,
    debitCount: 37,
    creditCount: 4,
    spent: 3868,
    received: 4140,
  });
  assert.equal(new Set(parsed.map((transaction) => transaction.sourceTransactionId)).size, 41);

  for (const [description, amount] of [
    ["Received from VIJAY KUMAR", 2500],
    ["Received from VIJAY KUMAR", 1500],
    ["Received from ******2414", 40],
    ["Received from HASIBUR RAHAMAN", 100],
  ] as const) {
    assert.equal(parsed.find((transaction) => transaction.description === description && transaction.amount === amount)?.type, "INCOME");
  }
  assert.equal(parsed.find((transaction) => transaction.description === "Paid to AYUSH SINGH RAMOLA")?.amount, 1500);
  assert.equal(parsed.find((transaction) => transaction.description === "Paid to AYUSH SINGH RAMOLA")?.type, "EXPENSE");
  assert.equal(parsed.find((transaction) => transaction.description === "Paid to Vijay Kumar")?.amount, 5);
  assert.equal(parsed.find((transaction) => transaction.description === "Paid to Vijay Kumar")?.type, "EXPENSE");
});

test("CSV parser falls back to description when an explicit type value is unknown", () => {
  const transactions = parseCSV([
    "Date,Description,Type,Amount",
    "2026-09-13,Received from ANIMESH ARYA,UPI,₹149",
  ].join("\n"));

  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount, 149);
  assert.equal(transactions[0].type, "INCOME");
});

test("CSV parser honors explicit type when debit and credit columns are empty", () => {
  const transactions = parseCSV([
    "Date,Description,Type,Amount,Debit,Credit",
    '2026-09-17,Received from VIJAY KUMAR,CREDIT,"₹2,500",,',
    '2026-09-18,Paid to AYUSH SINGH RAMOLA,DEBIT,"₹1,500",,',
  ].join("\n"));

  assert.deepEqual(transactions.map(({ amount, type }) => ({ amount, type })), [
    { amount: 2500, type: "INCOME" },
    { amount: 1500, type: "EXPENSE" },
  ]);
});

test("import-level totals do not include transactions from other imports", () => {
  const importA = [
    { amount: 100, type: "INCOME" as const },
    { amount: 1500, type: "INCOME" as const },
    { amount: 40, type: "INCOME" as const },
    { amount: 2500, type: "INCOME" as const },
    { amount: 3868, type: "EXPENSE" as const },
  ];
  const importB = [
    { amount: 50000, type: "EXPENSE" as const },
    { amount: 10000, type: "INCOME" as const },
  ];

  const summaryA = summarizeImportTransactions(importA);
  assert.equal(summaryA.transactionCount, 5);
  assert.equal(summaryA.creditCount, 4);
  assert.equal(summaryA.debitCount, 1);
  assert.equal(summaryA.received, 4140);
  assert.equal(summaryA.spent, 3868);

  const summaryB = summarizeImportTransactions(importB);
  assert.equal(summaryB.transactionCount, 2);
  assert.equal(summaryB.spent, 50000);
  assert.equal(summaryB.received, 10000);
});

test("re-importing the exact same PhonePe CSV produces identical keys and prevents duplicate transactions", () => {
  const csvContent = [
    "Date,Details,Transaction Type,Amount (INR),UTR Number",
    "2026-08-26,Received from HASIBUR RAHAMAN,CREDIT,₹100,PP-C-100",
    '2026-08-30,Received from VIJAY KUMAR,CREDIT,"₹1,500",PP-C-1500',
    "2026-09-11,Received from ******2414,CREDIT,₹40,PP-C-40",
    '2026-09-17,Received from VIJAY KUMAR,CREDIT,"₹2,500",PP-C-2500',
    '2026-09-12,Paid to AYUSH SINGH RAMOLA,DEBIT,"₹1,500",PP-D-AYUSH',
    "2026-09-13,Paid to Vijay Kumar,DEBIT,₹5,PP-D-VIJAY",
  ].join("\n");

  const firstParse = parseCSV(csvContent);
  const secondParse = parseCSV(csvContent);

  assert.equal(firstParse.length, secondParse.length);
  const firstKeys = new Set(firstParse.map((t) => t.sourceTransactionId));
  const secondKeys = new Set(secondParse.map((t) => t.sourceTransactionId));
  assert.deepEqual(firstKeys, secondKeys);

  // When deduplicating by sourceTransactionId, re-importing identical rows results in no new entries
  const deduplicated = new Map<string, typeof firstParse[0]>();
  for (const t of [...firstParse, ...secondParse]) {
    if (t.sourceTransactionId) {
      deduplicated.set(t.sourceTransactionId, t);
    }
  }
  assert.equal(deduplicated.size, 6);
});

test("CSV parser handles 'Debit / Credit' combined column header and preserves CREDIT as income", () => {
  const csv = [
    "Date,Description,Debit / Credit,Amount",
    '2026-09-17,Received from VIJAY KUMAR,CREDIT,"₹2,500"',
    '2026-09-18,Paid to AYUSH SINGH RAMOLA,DEBIT,"₹1,500"',
  ].join("\n");
  const parsed = parseCSV(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].type, "INCOME");
  assert.equal(parsed[0].amount, 2500);
  assert.equal(parsed[1].type, "EXPENSE");
  assert.equal(parsed[1].amount, 1500);
});

test("CSV parser rejects malformed amount text instead of accepting a numeric prefix", () => {
  const transactions = parseCSV([
    "Date,Description,Amount",
    '2026-09-01,Invalid amount,"₹1,50oops"',
  ].join("\n"));

  assert.equal(transactions.length, 0);
});

test("CSV parser accepts currency-suffixed amount headers and UTF-16 exports", () => {
  const utf8Csv = "Date,Description,Amount (INR)\n2026-09-01,Cafe,₹150.00";
  const transactions = parseCSV(utf8Csv);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount, 150);

  const utf16Csv = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Date,Description,Amount\r\n2026-09-02,Bookshop,₹250.00", "utf16le")]);
  const decoded = decodeCSVBytes(utf16Csv);
  assert.equal(parseCSV(decoded)[0].description, "Bookshop");
  assert.equal(parseCSV(decoded)[0].amount, 250);
});

test("merchant normalization prefers persisted user mappings", () => {
  assert.equal(normalizeMerchant("UPI/ZOMATO-123456"), "Zomato");
  assert.equal(normalizeWithUserMappings("CARD/LOCAL-CAFE-9988", [{ name: "Corner Cafe", rawPatterns: ["local cafe"] }]), "Corner Cafe");
});

test("merchant defaults resolve to a user-owned category and rule matches are bounded", () => {
  const categories = [{ id: 4, name: "Food" }] as Parameters<typeof categorizeTransaction>[2];
  assert.equal(categorizeTransaction("Zomato", "UPI Zomato", categories).categoryId, 4);
  assert.equal(matchesSpendingRule({ description: "UPI Zomato" }, "Zomato", { merchantId: null, pattern: "zomato|swiggy" }), true);
  assert.equal(matchesSpendingRule({ description: "a".repeat(100_000) }, "", { merchantId: null, pattern: "(a+)+$" }), false);
});

test("category and spending-rule inputs reject invalid values and patterns", () => {
  assert.equal(categoryInputSchema.safeParse({ name: "Food", color: "#55735d" }).success, true);
  assert.equal(categoryInputSchema.safeParse({ name: "", color: "red" }).success, false);
  assert.equal(spendingRuleInputSchema.safeParse({ pattern: "[" }).success, false);
  assert.equal(spendingRuleInputSchema.safeParse({ pattern: "(a+)+$" }).success, false);
});

test("natural-language search extracts type, category, amount, and month", () => {
  const now = new Date(2026, 8, 15, 12);
  const parsed = parseNaturalLanguageQuery(
    "food expenses over ₹500 last month",
    [{ id: 1, name: "Food" }],
    [],
    now
  );
  assert.equal(parsed.type, "EXPENSE");
  assert.equal(parsed.categoryId, 1);
  assert.equal(parsed.minAmount, 500);
  assert.equal(parsed.startDate?.getMonth(), 7);
  assert.equal(parsed.startDate?.getDate(), 1);
});
