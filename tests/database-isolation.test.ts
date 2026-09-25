import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("transactions remain scoped to their owning user", { skip: !testDatabaseUrl && "Set TEST_DATABASE_URL to run database isolation tests" }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl!;
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("../app/generated/prisma/client"),
    import("@prisma/adapter-pg"),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const suffix = randomUUID();
  const users: number[] = [];

  try {
    const first = await prisma.user.create({ data: { name: "Isolation A", email: `isolation-a-${suffix}@example.invalid`, passwordHash: "test-only" } });
    users.push(first.id);
    const second = await prisma.user.create({ data: { name: "Isolation B", email: `isolation-b-${suffix}@example.invalid`, passwordHash: "test-only" } });
    users.push(second.id);
    const [firstCategory, secondCategory] = await Promise.all([
      prisma.category.create({ data: { userId: first.id, name: `Test A ${suffix}`, type: "EXPENSE" } }),
      prisma.category.create({ data: { userId: second.id, name: `Test B ${suffix}`, type: "EXPENSE" } }),
    ]);
    await Promise.all([
      prisma.transaction.create({ data: { userId: first.id, categoryId: firstCategory.id, amount: 100, type: "EXPENSE", description: "A row", transactionDate: new Date("2026-09-01T12:00:00Z") } }),
      prisma.transaction.create({ data: { userId: second.id, categoryId: secondCategory.id, amount: 200, type: "EXPENSE", description: "B row", transactionDate: new Date("2026-09-02T12:00:00Z") } }),
    ]);
    await prisma.transaction.createMany({
      data: [
        { userId: first.id, categoryId: firstCategory.id, amount: 500, type: "EXPENSE", description: "A food row", transactionDate: new Date("2026-09-03T12:00:00Z") },
        { userId: first.id, categoryId: firstCategory.id, amount: 25_000, type: "INCOME", description: "A income row", transactionDate: new Date("2026-09-04T12:00:00Z") },
        { userId: first.id, categoryId: firstCategory.id, amount: 700, type: "EXPENSE", description: "A previous month row", transactionDate: new Date("2026-08-04T12:00:00Z") },
      ],
    });

    const [firstRows, secondRows] = await Promise.all([
      prisma.transaction.findMany({ where: { userId: first.id } }),
      prisma.transaction.findMany({ where: { userId: second.id } }),
    ]);
    assert.deepEqual(firstRows.map((row) => row.description), ["A row"]);
    assert.deepEqual(secondRows.map((row) => row.description), ["B row"]);
    assert.equal(firstRows.some((row) => row.userId !== first.id), false);
    assert.equal(secondRows.some((row) => row.userId !== second.id), false);

    const { generateReport, getMonthlyComparison } = await import("../lib/analytics/report");
    const [firstReport, secondReport, comparison] = await Promise.all([
      generateReport(first.id, 2026, 9),
      generateReport(second.id, 2026, 9),
      getMonthlyComparison(first.id, 2026, 8, 2026, 9),
    ]);
    assert.equal(firstReport.totalIncome, 25_000);
    assert.equal(firstReport.totalExpense, 600);
    assert.equal(firstReport.netSavings, 24_400);
    assert.equal(firstReport.categoryBreakdown[0].amount, 600);
    assert.equal(firstReport.monthOverMonth.previousTotal, 700);
    assert.equal(firstReport.monthOverMonth.change, -100);
    assert.equal(secondReport.totalExpense, 200);
    assert.deepEqual(secondReport.expensiveTransactions.map((row) => row.description), ["B row"]);
    assert.equal(comparison.month1.total, 700);
    assert.equal(comparison.month2.total, 600);

    const preference = await prisma.notificationPreference.create({
      data: { userId: first.id, monthlyReminderEnabled: false, recurringPaymentEnabled: true, reminderDay: 20 },
    });
    assert.equal(preference.monthlyReminderEnabled, false);
    assert.equal(preference.recurringPaymentEnabled, true);
    assert.equal(preference.reminderDay, 20);
    const notification = {
      userId: first.id,
      type: "REPORT_READY" as const,
      title: "Test report ready",
      message: "Test notification",
      dedupeKey: `report-ready:test:${suffix}`,
    };
    const notificationInsert = await prisma.notification.createMany({
      data: [notification, notification],
      skipDuplicates: true,
    });
    assert.equal(notificationInsert.count, 1);
    assert.equal(await prisma.notification.count({ where: { userId: first.id, dedupeKey: notification.dedupeKey } }), 1);
    assert.equal(await prisma.notification.count({ where: { userId: second.id, dedupeKey: notification.dedupeKey } }), 0);
  } finally {
    if (users.length) {
      await prisma.transaction.deleteMany({ where: { userId: { in: users } } });
      await prisma.spendingRule.deleteMany({ where: { userId: { in: users } } });
      await prisma.monthlyReport.deleteMany({ where: { userId: { in: users } } });
      await prisma.import.deleteMany({ where: { userId: { in: users } } });
      await prisma.merchant.deleteMany({ where: { userId: { in: users } } });
      await prisma.category.deleteMany({ where: { userId: { in: users } } });
      await prisma.notification.deleteMany({ where: { userId: { in: users } } });
      await prisma.notificationPreference.deleteMany({ where: { userId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  }
});
