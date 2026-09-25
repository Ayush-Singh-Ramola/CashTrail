export interface MerchantMapping {
  name: string;
  rawPatterns: string[];
}

const MERCHANT_PATTERNS: Record<string, string[]> = {
  zomato: ["zomato", "zomato online", "zomato pay"],
  swiggy: ["swiggy", "swiggy instamart", "swiggy genie"],
  uber: ["uber", "uber india", "uber trip"],
  ola: ["ola", "ola cabs", "ola electric"],
  amazon: ["amazon", "amazon.in", "amazon pay", "amzn"],
  flipkart: ["flipkart", "flipkart.com"],
  myntra: ["myntra"],
  spotify: ["spotify", "spotify premium"],
  netflix: ["netflix"],
  youtube: ["youtube premium", "youtube music", "google youtube"],
  google: ["google one", "google play", "google storage"],
  airtel: ["airtel", "airtel thanks", "airtel payments"],
  jio: ["jio", "jio fiber", "jio recharge"],
  paytm: ["paytm", "paytm wallet", "paytm payments"],
  phonepe: ["phonepe", "phonepe wallet"],
  gpay: ["google pay", "gpay", "gpays"],
  bluetooth: ["bluetooth", "bluetooth speaker"],
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function normalizeMerchant(rawDescription: string): string {
  const normalized = normalizeText(rawDescription);
  for (const [merchant, patterns] of Object.entries(MERCHANT_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) return capitalize(merchant);
    }
  }
  const words = normalized.split(" ").filter((word) => word.length > 2);
  return words.length > 0 ? capitalize(words[0]) : "Unknown";
}

export function normalizeWithUserMappings(rawDescription: string, merchants: MerchantMapping[]): string {
  const normalizedDescription = normalizeText(rawDescription);
  const mapped = merchants.find((merchant) => merchant.rawPatterns.some((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    return normalizedPattern.length >= 2 && normalizedDescription.includes(normalizedPattern);
  }));
  return mapped?.name ?? normalizeMerchant(rawDescription);
}
