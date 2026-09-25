import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseCSV, type ParsedTransaction } from "./csv";

type PositionedText = { text: string; x: number; y: number };
type Column = "date" | "time" | "description" | "amount" | "debit" | "credit" | "type" | "status";

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnForLabel(label: string): Column | null {
  const value = normalizeLabel(label);
  if (/^(date|txndate|transactiondate|valuedate|postingdate|paymentdate|dateandtime|datetime)(?:ist|utc|gmt|local)?$/.test(value)) return "date";
  if (/^(time|txntime|transactiontime)$/.test(value)) return "time";
  if (/^(description|details|transactiondetails|particulars|narration|remarks|merchant|merchantname|payee|paidto|receivedfrom|memo)$/.test(value)) return "description";
  if (/^(debit|withdrawal|withdrawals|dr|debitamount|withdrawalamount)$/.test(value)) return "debit";
  if (/^(credit|deposit|deposits|cr|creditamount|depositamount)$/.test(value)) return "credit";
  if (/^(amount|txnamount|transactionamount|netamount|total|amt)(?:inr|rs|rupees|usd|eur|gbp|aud)?$/.test(value)) return "amount";
  if (/^(type|txntype|transactiontype|crdr|drcr|creditdebit|debitcredit|direction)$/.test(value)) return "type";
  if (/^(status|paymentstatus|transactionstatus|txnstatus|state)$/.test(value)) return "status";
  return null;
}

function groupTextItems(items: PositionedText[]): PositionedText[][] {
  const ordered = [...items].sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: PositionedText[][] = [];
  for (const item of ordered) {
    let line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= 2.5);
    if (!line) {
      line = [];
      lines.push(line);
    }
    line.push(item);
  }
  return lines.map((line) => line.sort((left, right) => left.x - right.x));
}

function findTableColumns(line: PositionedText[]): Array<{ column: Column; x: number }> | null {
  const columns: Array<{ column: Column; x: number }> = [];
  for (const item of line) {
    const column = columnForLabel(item.text);
    if (column && !columns.some((existing) => existing.column === column)) {
      columns.push({ column, x: item.x + Math.max(item.text.length, 1) * 1.5 });
    }
  }
  const hasDate = columns.some((column) => column.column === "date");
  const hasDescription = columns.some((column) => column.column === "description");
  const hasAmount = columns.some((column) => ["amount", "debit", "credit"].includes(column.column));
  return hasDate && hasAmount && (hasDescription || hasAmount) ? columns.sort((a, b) => a.x - b.x) : null;
}

function quoteCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function rowToCsv(line: PositionedText[], columns: Array<{ column: Column; x: number }>): string {
  const cells = new Map<Column, string>();
  for (const item of line) {
    const nearest = columns.reduce((best, column) =>
      Math.abs(column.x - item.x) < Math.abs(best.x - item.x) ? column : best
    );
    const previous = cells.get(nearest.column);
    cells.set(nearest.column, previous ? `${previous} ${item.text}` : item.text);
  }
  return columns.map(({ column }) => quoteCsvCell(cells.get(column)?.trim() ?? "")).join(",");
}

function headerToCsv(columns: Array<{ column: Column }>): string {
  const names: Record<Column, string> = {
    date: "Date",
    time: "Time",
    description: "Description",
    amount: "Amount",
    debit: "Debit",
    credit: "Credit",
    type: "Type",
    status: "Status",
  };
  return columns.map(({ column }) => quoteCsvCell(names[column])).join(",");
}

/** Extracts simple text-table statements. Scanned/image-only PDFs are reported as unsupported. */
export async function parsePdfStatement(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 8 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("The selected file is not a valid PDF");
  }

  const task = getDocument({ data: bytes, useSystemFonts: true });
  const document = await task.promise;
  const csvRows: string[] = [];
  let columns: Array<{ column: Column; x: number }> | null = null;

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PositionedText[] = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        return [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }];
      });

      for (const line of groupTextItems(items)) {
        const candidate = findTableColumns(line);
        if (candidate) {
          columns = candidate;
          if (csvRows.length === 0) csvRows.push(headerToCsv(columns));
          continue;
        }
        if (columns) csvRows.push(rowToCsv(line, columns));
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  if (csvRows.length < 2) {
    throw new Error("This PDF does not contain a supported text transaction table. Scanned PDFs are not supported.");
  }
  const transactions = parseCSV(csvRows.join("\n"));
  if (transactions.length === 0) {
    throw new Error("No transactions were found in the PDF table");
  }
  return transactions;
}
