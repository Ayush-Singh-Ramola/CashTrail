import { endOfMonth, startOfMonth, subMonths } from "date-fns";

export interface SearchEntity {
  id: number;
  name: string;
}

export interface ParsedSearchQuery {
  type?: "INCOME" | "EXPENSE";
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  categoryName?: string;
  merchantId?: number;
  merchantName?: string;
  text?: string;
  description: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseAmount(value: string): number | undefined {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function findMonthRange(query: string, now: Date): { startDate: Date; endDate: Date; label: string } | null {
  if (/\b(this|current) month\b/i.test(query)) {
    return { startDate: startOfMonth(now), endDate: endOfMonth(now), label: "this month" };
  }
  if (/\b(last|previous) month\b/i.test(query)) {
    const previous = subMonths(now, 1);
    return { startDate: startOfMonth(previous), endDate: endOfMonth(previous), label: "last month" };
  }
  const yearMonth = /\b(\d{4})-(0[1-9]|1[0-2])\b/.exec(query);
  if (yearMonth) {
    const date = new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1);
    return { startDate: startOfMonth(date), endDate: endOfMonth(date), label: date.toLocaleString("en", { month: "long", year: "numeric" }) };
  }
  const month = new RegExp(`\\b(${MONTHS.join("|")})(?:\\s+(\\d{4}))?\\b`, "i").exec(query);
  if (!month) return null;
  const year = month[2] ? Number(month[2]) : now.getFullYear();
  const date = new Date(year, MONTHS.indexOf(month[1].toLowerCase()), 1);
  return { startDate: startOfMonth(date), endDate: endOfMonth(date), label: date.toLocaleString("en", { month: "long", year: "numeric" }) };
}

export function parseNaturalLanguageQuery(
  rawQuery: string,
  categories: SearchEntity[] = [],
  merchants: SearchEntity[] = [],
  now = new Date()
): ParsedSearchQuery {
  const query = rawQuery.trim();
  const parsed: ParsedSearchQuery = { description: "Showing matching transactions" };

  if (/\b(income|received|salary|earned|deposit)\b/i.test(query)) parsed.type = "INCOME";
  else if (/\b(spent|spending|expense|expenses|paid|purchase|purchases)\b/i.test(query)) parsed.type = "EXPENSE";

  const between = /\bbetween\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)\s+(?:and|to)\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)/i.exec(query);
  if (between) {
    const first = parseAmount(between[1]);
    const second = parseAmount(between[2]);
    if (first !== undefined && second !== undefined) {
      parsed.minAmount = Math.min(first, second);
      parsed.maxAmount = Math.max(first, second);
    }
  } else {
    const bound = /\b(over|above|more than|greater than|at least|under|below|less than|up to)\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)/i.exec(query);
    if (bound) {
      const amount = parseAmount(bound[2]);
      if (amount !== undefined) {
        if (/^(under|below|less than|up to)$/i.test(bound[1])) parsed.maxAmount = amount;
        else parsed.minAmount = amount;
      }
    }
  }

  const monthRange = findMonthRange(query, now);
  if (monthRange) {
    parsed.startDate = monthRange.startDate;
    parsed.endDate = monthRange.endDate;
    parsed.description = `Transactions for ${monthRange.label}`;
  }

  const normalizedQuery = query.toLocaleLowerCase();
  const category = [...categories].sort((left, right) => right.name.length - left.name.length)
    .find((candidate) => normalizedQuery.includes(candidate.name.toLocaleLowerCase()));
  const merchant = [...merchants].sort((left, right) => right.name.length - left.name.length)
    .find((candidate) => normalizedQuery.includes(candidate.name.toLocaleLowerCase()));
  if (category) {
    parsed.categoryId = category.id;
    parsed.categoryName = category.name;
  }
  if (merchant) {
    parsed.merchantId = merchant.id;
    parsed.merchantName = merchant.name;
  }

  const hasStructuredCriteria = parsed.type || parsed.minAmount !== undefined || parsed.maxAmount !== undefined ||
    parsed.startDate || parsed.categoryId || parsed.merchantId;
  if (!hasStructuredCriteria) parsed.text = query;
  const conditions = [
    parsed.type === "EXPENSE" ? "expenses" : parsed.type === "INCOME" ? "income" : null,
    parsed.categoryName ? `in ${parsed.categoryName}` : null,
    parsed.merchantName ? `from ${parsed.merchantName}` : null,
    parsed.minAmount !== undefined ? `at least ₹${parsed.minAmount}` : null,
    parsed.maxAmount !== undefined ? `up to ₹${parsed.maxAmount}` : null,
    monthRange?.label ? `during ${monthRange.label}` : null,
  ].filter(Boolean);
  if (conditions.length) parsed.description = `Showing ${conditions.join(" ")}`;
  return parsed;
}
