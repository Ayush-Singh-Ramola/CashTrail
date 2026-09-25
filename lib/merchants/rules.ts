import type { ParsedTransaction } from "@/lib/parsers/csv";

export function compileSpendingRulePattern(pattern: string): RegExp | null {
  if (pattern.length > 120 || /\\[1-9]|\(\?|\)\s*[+*{]|(?:\.\*|\.\+){2,}/.test(pattern)) return null;
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export function matchesSpendingRule(
  transaction: Pick<ParsedTransaction, "description">,
  normalizedName: string,
  rule: { merchantId: number | null; pattern: string },
  merchantId?: number
): boolean {
  if (rule.merchantId !== null) return rule.merchantId === merchantId;
  const expression = compileSpendingRulePattern(rule.pattern);
  return expression !== null && (expression.test(transaction.description) || expression.test(normalizedName));
}
