import { prisma } from "@/lib/prisma";

export { normalizeMerchant, normalizeWithUserMappings } from "./normalize-core";

export async function findOrCreateMerchant(userId: number, normalizedName: string, rawDescription: string) {
  const existing = await prisma.merchant.findFirst({
    where: { userId, name: { equals: normalizedName, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.merchant.create({ data: { userId, name: normalizedName, rawPatterns: [rawDescription] } });
}

export async function updateMerchantPatterns(userId: number, merchantId: number, rawDescription: string) {
  const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, userId } });
  if (!merchant) return;
  const patterns = new Set(merchant.rawPatterns);
  patterns.add(rawDescription);
  await prisma.merchant.update({ where: { id: merchantId }, data: { rawPatterns: Array.from(patterns) } });
}
