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

const KEYWORD_RULES: Array<{ category: string; classification: "ESSENTIAL" | "USEFUL" | "DISCRETIONARY" | "CUSTOM"; keywords: string[] }> = [
  {
    category: "Food",
    classification: "DISCRETIONARY",
    keywords: ["cafe", "restaurant", "momo", "dhaba", "food", "bakery", "sweets", "kitchen", "tea", "coffee", "bhojnalaya", "hotel", "burger", "pizza", "biryani", "canteen", "snacks", "dining"],
  },
  {
    category: "Travel",
    classification: "ESSENTIAL",
    keywords: ["fuel", "petrol", "diesel", "hpcl", "bpcl", "ioc", "auto", "metro", "irctc", "railway", "cab", "toll", "parking", "flight", "transport"],
  },
  {
    category: "Shopping",
    classification: "DISCRETIONARY",
    keywords: ["mart", "store", "supermarket", "retail", "garment", "hosiery", "zudio", "fashion", "mall", "clothing", "dress", "footwear", "bazaar"],
  },
  {
    category: "Health",
    classification: "ESSENTIAL",
    keywords: ["medical", "pharmacy", "chemist", "clinic", "hospital", "pharma", "apollo", "medicos", "health", "dental", "doctor"],
  },
  {
    category: "Bills",
    classification: "ESSENTIAL",
    keywords: ["recharge", "electricity", "bill", "broadband", "water", "gas", "utility", "postpaid", "dth"],
  },
  {
    category: "Entertainment",
    classification: "DISCRETIONARY",
    keywords: ["cinema", "theatre", "movie", "bookmyshow", "pvr", "inox", "gaming", "steam"],
  },
  {
    category: "Education",
    classification: "USEFUL",
    keywords: ["school", "college", "university", "institute", "course", "fees", "tuition", "books"],
  },
];

export function categorizeTransaction(
  merchantName: string,
  description: string,
  categories: Category[],
  type?: "INCOME" | "EXPENSE" | "TRANSFER"
): { categoryId?: number; classification?: "ESSENTIAL" | "USEFUL" | "DISCRETIONARY" | "CUSTOM" } {
  const normMerchant = merchantName.toLowerCase();
  const normDesc = description.toLowerCase();
  const combined = `${normMerchant} ${normDesc}`;

  const isIncome = type === "INCOME" ||
    normDesc.startsWith("received from") ||
    normDesc.includes("cashback") ||
    normDesc.includes("refund from") ||
    normDesc.includes("interest credited") ||
    normDesc.includes("salary");

  if (isIncome) {
    const incomeCategory = categories.find((c) => c.type === "INCOME" || c.name.toLowerCase() === "income");
    if (incomeCategory) {
      return {
        categoryId: incomeCategory.id,
        classification: "ESSENTIAL",
      };
    }
  }

  // 1. Direct merchant matching
  for (const [merchant, info] of Object.entries(MERCHANT_CATEGORIES)) {
    if (normMerchant.includes(merchant) || normDesc.includes(merchant)) {
      const category = categories.find(
        (c) => c.name.toLowerCase() === info.category.toLowerCase()
      );
      if (category) {
        return {
          categoryId: category.id,
          classification: info.classification,
        };
      }
    }
  }

  // 2. Keyword heuristic matching from merchant name and description
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      const category = categories.find(
        (c) => c.name.toLowerCase() === rule.category.toLowerCase()
      );
      if (category) {
        return {
          categoryId: category.id,
          classification: rule.classification,
        };
      }
    }
  }

  const otherCategory = categories.find((c) => c.name.toLowerCase() === "other");
  return {
    categoryId: otherCategory?.id,
    classification: "CUSTOM",
  };
}
