import type { Category } from "@/app/generated/prisma/client";

const MERCHANT_CATEGORIES: Record<string, { category: string; classification: "ESSENTIAL" | "USEFUL" | "DISCRETIONARY" | "CUSTOM" }> = {
  zomato: { category: "Food", classification: "DISCRETIONARY" },
  swiggy: { category: "Food", classification: "DISCRETIONARY" },
  uber: { category: "Travel", classification: "ESSENTIAL" },
  ola: { category: "Travel", classification: "ESSENTIAL" },
  amazon: { category: "Shopping", classification: "DISCRETIONARY" },
  flipkart: { category: "Shopping", classification: "DISCRETIONARY" },
  myntra: { category: "Shopping", classification: "DISCRETIONARY" },
  spotify: { category: "Subscriptions", classification: "USEFUL" },
  netflix: { category: "Entertainment", classification: "DISCRETIONARY" },
  youtube: { category: "Subscriptions", classification: "USEFUL" },
  google: { category: "Subscriptions", classification: "USEFUL" },
  airtel: { category: "Bills", classification: "ESSENTIAL" },
  jio: { category: "Bills", classification: "ESSENTIAL" },
  paytm: { category: "Other", classification: "CUSTOM" },
  phonepe: { category: "Other", classification: "CUSTOM" },
  gpay: { category: "Other", classification: "CUSTOM" },
};

export function categorizeTransaction(
  merchantName: string,
  _description: string,
  categories: Category[]
): { categoryId?: number; classification?: "ESSENTIAL" | "USEFUL" | "DISCRETIONARY" | "CUSTOM" } {
  const normalized = merchantName.toLowerCase();

  for (const [merchant, info] of Object.entries(MERCHANT_CATEGORIES)) {
    if (normalized.includes(merchant)) {
      const category = categories.find(
        (c) => c.name.toLowerCase() === info.category.toLowerCase()
      );
      return {
        categoryId: category?.id,
        classification: info.classification,
      };
    }
  }

  const otherCategory = categories.find((c) => c.name.toLowerCase() === "other");
  return {
    categoryId: otherCategory?.id,
    classification: "CUSTOM",
  };
}
