import { prisma } from "../lib/prisma";

async function main() {
  const categories = await prisma.category.findMany();
  console.log("Categories:", categories);

  const txns = await prisma.transaction.findMany({
    where: { importId: 14 },
    select: { id: true, categoryId: true, category: true },
    take: 5
  });
  console.log("Sample txns:", txns);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
