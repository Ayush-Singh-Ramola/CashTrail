import { z } from "zod";
import { compileSpendingRulePattern } from "@/lib/merchants/rules";

export const spendingClassificationSchema = z.enum([
  "ESSENTIAL",
  "USEFUL",
  "DISCRETIONARY",
  "CUSTOM",
]);

const optionalClassification = spendingClassificationSchema.nullable().optional();

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).default("EXPENSE"),
  icon: z.string().trim().max(12).nullable().optional(),
  color: z.string().regex(/^#[\da-f]{6}$/i).nullable().optional(),
  classification: optionalClassification,
});

export const categoryPatchSchema = categoryInputSchema.partial();

export const merchantPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  rawPatterns: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  defaultCategoryId: z.number().int().positive().nullable().optional(),
  classification: optionalClassification,
});

export const transactionPatchSchema = z.object({
  amount: z.number().positive().max(1_000_000_000).optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  transactionDate: z.iso.datetime({ offset: true }).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  merchantId: z.number().int().positive().nullable().optional(),
  classification: optionalClassification,
  notes: z.string().trim().max(1000).nullable().optional(),
});

const spendingRuleBaseSchema = z.object({
  pattern: z.string().trim().min(1).max(120),
  merchantId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  classification: optionalClassification,
  priority: z.number().int().min(-1000).max(1000).default(0),
});

function validateRulePattern(value: { pattern?: string }, context: z.RefinementCtx): void {
  if (value.pattern !== undefined && !compileSpendingRulePattern(value.pattern)) {
    context.addIssue({ code: "custom", path: ["pattern"], message: "Pattern must be a valid regular expression" });
  }
}

export const spendingRuleInputSchema = spendingRuleBaseSchema.superRefine(validateRulePattern);

export const spendingRulePatchSchema = spendingRuleBaseSchema.partial().superRefine(validateRulePattern);

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
