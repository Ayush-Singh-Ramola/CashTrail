import assert from "node:assert/strict";
import test from "node:test";
import { decodeCSVBytes, parseCSV, parseCSVToRows } from "../lib/parsers/csv";
import { normalizeMerchant, normalizeWithUserMappings } from "../lib/merchants/normalize-core";
import { categorizeTransaction } from "../lib/merchants/categorize";
import { matchesSpendingRule } from "../lib/merchants/rules";
import { parseNaturalLanguageQuery } from "../lib/search/natural-language";
import { categoryInputSchema, spendingRuleInputSchema } from "../lib/validations/finance";

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
