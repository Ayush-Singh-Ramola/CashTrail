import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeCSVBytes, parseCSV, type ParsedTransaction } from "@/lib/parsers/csv";
import { parsePdfStatement } from "@/lib/parsers/pdf";
import { normalizeWithUserMappings } from "@/lib/merchants/normalize";
import { matchesSpendingRule } from "@/lib/merchants/rules";
import { categorizeTransaction } from "@/lib/merchants/categorize";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CREATE_MANY_BATCH_SIZE = 500;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
  const requestedPage = Number(request.nextUrl.searchParams.get("page") || 1);
  const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1;

  const [imports, total] = await Promise.all([
    prisma.import.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        fileName: true,
        status: true,
        transactionCount: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.import.count({ where: { userId: session.id } }),
  ]);

  return NextResponse.json({ imports, total, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "Choose a statement smaller than 10 MB" }, { status: 413 });
  }

  let importId: number | null = null;
  let importFileType: "csv" | "pdf" | null = null;
  let processingStep: "validating" | "database" | "parsing" | "saving" = "validating";
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a CSV or PDF statement to import" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The selected CSV file is empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Choose a statement smaller than 10 MB" }, { status: 413 });
    }

    const fileName = file.name.trim().slice(0, 180);
    const extension = fileName.toLowerCase().split(".").pop();
    const bytes = Buffer.from(await file.arrayBuffer());
    const isPdf = extension === "pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    const isCsv = extension === "csv" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-";
    if (!isPdf && !isCsv) {
      return NextResponse.json({ error: "Choose a valid CSV or PDF statement file" }, { status: 415 });
    }
    importFileType = isPdf ? "pdf" : "csv";

    processingStep = "database";
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const duplicate = await prisma.import.findUnique({
      where: { userId_contentHash: { userId: session.id, contentHash } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This statement has already been imported", importId: duplicate.id }, { status: 409 });
    }

    const importRecord = await prisma.import.create({
      data: {
        userId: session.id,
        fileName,
        fileType: isPdf ? "pdf" : "csv",
        contentHash,
        status: "PROCESSING",
      },
    });
    importId = importRecord.id;

    processingStep = "parsing";
    const transactions = isPdf
      ? await parsePdfStatement(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
      : parseCSV(decodeCSVBytes(bytes));
    processingStep = "saving";
    if (transactions.length === 0) {
      await prisma.import.update({
        where: { id: importRecord.id },
        data: { status: "FAILED", errorMessage: "No valid transactions found" },
      });
      await prisma.import.update({ where: { id: importRecord.id }, data: { contentHash: null } });
      return NextResponse.json({ error: "No valid transactions found" }, { status: 400 });
    }

    await processTransactions(session.id, importRecord.id, transactions);
    await prisma.import.update({
      where: { id: importRecord.id },
      data: { status: "COMPLETED", transactionCount: transactions.length },
    });

    try {
      const preferences = await prisma.notificationPreference.findUnique({ where: { userId: session.id } });
      if (preferences?.reportReadyEnabled ?? true) {
        await prisma.notification.create({
          data: {
            userId: session.id,
            type: "REPORT_READY",
            title: "Your statement is ready",
            message: `${transactions.length} transactions were imported from ${fileName}.`,
            href: `/imports/${importRecord.id}`,
            dedupeKey: `report-ready:import:${importRecord.id}`,
          },
        });
      }
    } catch {
      console.error("Report notification could not be created");
    }

    return NextResponse.json({ importId: importRecord.id, transactionCount: transactions.length });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code === "P2002") {
      return NextResponse.json({ error: "This statement has already been imported" }, { status: 409 });
    }
    const parseMessage = error instanceof Error && /^(The selected file|This PDF|No transactions)/.test(error.message)
      ? error.message
      : null;
    const pdfReaderMessage = importFileType === "pdf" && processingStep === "parsing" && !parseMessage
      ? "The PDF reader encountered an internal error. Restart the app and try again; check the app terminal if it continues."
      : null;
    const databaseMessage = processingStep === "database"
      ? "The file was uploaded, but the database could not start the import. Check that PostgreSQL is running and try again."
      : processingStep === "saving"
        ? "The statement was read, but its transactions could not be saved. Check the app terminal for the database error and try again."
        : null;
    const errorMessage = parseMessage ?? pdfReaderMessage ?? databaseMessage ?? "The statement could not be processed. Check the file and try again.";
    if (!parseMessage) console.error(`Statement processing failed during ${processingStep}`);
    if (importId !== null) {
      try {
        await prisma.import.update({
          where: { id: importId },
          data: {
            status: "FAILED",
            contentHash: null,
            errorMessage,
          },
        });
      } catch (updateError) {
        console.error("Failed to mark import as failed:", updateError);
      }
    }
    const status = parseMessage ? 400 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

async function processTransactions(userId: number, importId: number, transactions: ParsedTransaction[]) {
  await prisma.$transaction(async (tx) => {
    const [categories, rules, merchants] = await Promise.all([
      tx.category.findMany({ where: { userId } }),
      tx.spendingRule.findMany({ where: { userId }, orderBy: { priority: "desc" } }),
      tx.merchant.findMany({ where: { userId }, select: { id: true, name: true, rawPatterns: true, classification: true, defaultCategoryId: true } }),
    ]);

    const merchantMap = new Map(merchants.map((merchant) => [merchant.name.toLowerCase(), merchant]));
    const merchantNames = new Map<string, { name: string; descriptions: Set<string> }>();
    for (const transaction of transactions) {
      const name = normalizeWithUserMappings(transaction.description, merchants);
      const key = name.toLowerCase();
      const entry = merchantNames.get(key) ?? { name, descriptions: new Set<string>() };
      entry.descriptions.add(transaction.description);
      merchantNames.set(key, entry);
    }

    for (const [key, merchant] of merchantNames) {
      const created = await tx.merchant.upsert({
        where: { userId_name: { userId, name: merchant.name } },
        create: { userId, name: merchant.name, rawPatterns: Array.from(merchant.descriptions) },
        update: { rawPatterns: { push: Array.from(merchant.descriptions) } },
        select: { id: true, name: true, rawPatterns: true, classification: true, defaultCategoryId: true },
      });
      merchantMap.set(key, created);
    }

    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const records = transactions.map((transaction) => {
      const normalizedName = normalizeWithUserMappings(transaction.description, merchants);
      const merchant = merchantMap.get(normalizedName.toLowerCase());
      const matchedRule = rules.find((rule) => matchesRule(transaction, normalizedName, rule, merchant?.id));
      const defaultCategory = categorizeTransaction(normalizedName, transaction.description, categories);
      const categoryId = matchedRule?.categoryId ?? merchant?.defaultCategoryId ?? defaultCategory.categoryId ?? null;
      const category = categoryId === null ? undefined : categoryMap.get(categoryId);
      const classification = matchedRule?.classification ?? merchant?.classification ?? category?.classification ?? defaultCategory.classification ?? null;

      return {
        userId,
        importId,
        merchantId: merchant?.id ?? null,
        categoryId,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        normalizedDesc: normalizedName,
        transactionDate: transaction.date,
        transactionTime: transaction.time ?? null,
        classification,
      };
    });

    for (let offset = 0; offset < records.length; offset += CREATE_MANY_BATCH_SIZE) {
      await tx.transaction.createMany({ data: records.slice(offset, offset + CREATE_MANY_BATCH_SIZE) });
    }
  }, { maxWait: 10_000, timeout: 60_000 });
}

function matchesRule(
  transaction: ParsedTransaction,
  normalizedName: string,
  rule: { merchantId: number | null; pattern: string },
  merchantId?: number
) {
  return matchesSpendingRule(transaction, normalizedName, rule, merchantId);
}
