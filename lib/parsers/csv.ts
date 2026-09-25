export interface ParsedTransaction {
  date: Date;
  time?: Date | null;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
}

export function decodeCSVBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Parses a CSV string into an array of string arrays (rows and cells),
 * correctly handling quoted values, escaped quotes, and newlines in quotes.
 */
export function parseCSVToRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ""); // Strip UTF-8 BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = "";
      // Ignore completely empty rows
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

interface ColumnIndexes {
  dateIdx: number;
  timeIdx: number;
  descIdx: number;
  amountIdx: number;
  debitIdx: number;
  creditIdx: number;
  typeIdx: number;
  statusIdx: number;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeaderRow(rows: string[][]): { headerIndex: number; columns: ColumnIndexes } | null {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r];
    const norm = row.map(normalizeHeader);

    let dateIdx = -1;
    let timeIdx = -1;
    let descIdx = -1;
    let amountIdx = -1;
    let debitIdx = -1;
    let creditIdx = -1;
    let typeIdx = -1;
    let statusIdx = -1;

    for (let c = 0; c < row.length; c++) {
      const header = norm[c];
      const raw = row[c].toLowerCase();

      // Date match
      if (/^(?:date|txndate|transactiondate|valuedate|postingdate|dateandtime|datetime|paymentdate|transactiondatetime)(?:ist|utc|gmt|local)?$/.test(header)) {
        if (dateIdx === -1) dateIdx = c;
      }

      // Time match
      if (header === "time" || header === "txntime" || header === "transactiontime") {
        if (timeIdx === -1) timeIdx = c;
      }

      // Description match
      if (
        header === "description" ||
        header === "transactiondetails" ||
        header === "details" ||
        header === "particulars" ||
        header === "narration" ||
        header === "remarks" ||
        header === "merchant" ||
        header === "merchantname" ||
        header === "payee" ||
        header === "paidto" ||
        header === "receivedfrom" ||
        header === "memo" ||
        header === "note" ||
        header === "name" ||
        header === "counterparty"
      ) {
        if (descIdx === -1) descIdx = c;
      }

      // Single Amount match
      if (/^(?:amount|txnamount|transactionamount|netamount|total|amt)(?:inr|rs|rupees|usd|eur|gbp|aud)?$/.test(header)) {
        if (amountIdx === -1) amountIdx = c;
      }

      // Debit match
      if (
        header === "debit" ||
        header === "withdrawal" ||
        header === "dr" ||
        header === "debitamount" ||
        header === "withdrawalamount" ||
        raw.includes("debit") ||
        raw.includes("withdrawal")
      ) {
        if (debitIdx === -1 && header !== "creditdebit" && header !== "crdr") debitIdx = c;
      }

      // Credit match
      if (
        header === "credit" ||
        header === "deposit" ||
        header === "cr" ||
        header === "creditamount" ||
        header === "depositamount" ||
        raw.includes("credit") ||
        raw.includes("deposit")
      ) {
        if (creditIdx === -1 && header !== "creditdebit" && header !== "crdr") creditIdx = c;
      }

      // Type match
      if (
        header === "type" ||
        header === "txntype" ||
        header === "transactiontype" ||
        header === "crdr" ||
        header === "drcr" ||
        header === "creditdebit" ||
        header === "debitcredit" ||
        header === "direction"
      ) {
        if (typeIdx === -1) typeIdx = c;
      }

      // Status match
      if (
        header === "status" ||
        header === "paymentstatus" ||
        header === "transactionstatus" ||
        header === "txnstatus" ||
        header === "state"
      ) {
        if (statusIdx === -1) statusIdx = c;
      }
    }

    const hasDate = dateIdx !== -1;
    const hasDesc = descIdx !== -1;
    const hasAmount = amountIdx !== -1 || (debitIdx !== -1 && creditIdx !== -1) || debitIdx !== -1;

    if (hasDate && (hasDesc || hasAmount)) {
      return {
        headerIndex: r,
        columns: {
          dateIdx,
          timeIdx,
          descIdx: descIdx !== -1 ? descIdx : dateIdx + 1, // Fallback if description is adjacent
          amountIdx,
          debitIdx,
          creditIdx,
          typeIdx,
          statusIdx,
        },
      };
    }
  }

  return null;
}

function parseAmountValue(raw: string): number {
  if (!raw) return 0;
  // Remove currency signs, commas, whitespace
  let clean = raw.replace(/[₹$€£\s,]/g, "");
  // Remove "INR", "Rs.", "Rs"
  clean = clean.replace(/^(inr|rs\.?)/i, "").trim();

  // Check parenthesized negative e.g. (150.00)
  const isParenNeg = /^\((.*)\)$/.test(clean);
  if (isParenNeg) {
    clean = clean.replace(/^\(|\)$/g, "");
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return isParenNeg ? -Math.abs(num) : num;
}

function isFailedStatus(statusStr: string): boolean {
  const norm = statusStr.trim().toLowerCase();
  if (!norm) return false;
  const failureKeywords = [
    "fail",
    "declined",
    "rejected",
    "cancelled",
    "canceled",
    "bounced",
    "reversed",
    "pending",
  ];
  return failureKeywords.some((kw) => norm.includes(kw));
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseDateAndOptionalTime(
  dateStr: string,
  timeStr?: string
): { date: Date | null; time: Date | null } {
  const trimmed = dateStr.trim();
  if (!trimmed) return { date: null, time: null };

  // Try Standard ISO Date first
  let dateObj: Date | null = null;
  let timeObj: Date | null = null;

  // Check format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    dateObj = new Date(y, m, d);
    if (isoMatch[4] !== undefined) {
      const hh = parseInt(isoMatch[4], 10);
      const mm = parseInt(isoMatch[5], 10);
      const ss = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
      timeObj = new Date(y, m, d, hh, mm, ss);
    }
  }

  // Check format: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  if (!dateObj) {
    const ddmmyyyy = trimmed.match(
      /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?)?/i
    );
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10) - 1;
      let y = parseInt(ddmmyyyy[3], 10);
      if (y < 100) y += 2000;
      dateObj = new Date(y, m, d);

      if (ddmmyyyy[4] !== undefined) {
        let hh = parseInt(ddmmyyyy[4], 10);
        const mm = parseInt(ddmmyyyy[5], 10);
        const ss = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
        const ampm = ddmmyyyy[7]?.toLowerCase();
        if (ampm === "pm" && hh < 12) hh += 12;
        if (ampm === "am" && hh === 12) hh = 0;
        timeObj = new Date(y, m, d, hh, mm, ss);
      }
    }
  }

  // Check format: DD Mon YYYY (e.g. "15 Jan 2024" or "15-Jan-2024")
  if (!dateObj) {
    const textDate = trimmed.match(
      /^(\d{1,2})[-/ ]+([a-zA-Z]+)[-/ ]+(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?)?/i
    );
    if (textDate) {
      const d = parseInt(textDate[1], 10);
      const monthKey = textDate[2].toLowerCase();
      let y = parseInt(textDate[3], 10);
      if (y < 100) y += 2000;
      if (monthKey in MONTH_NAMES) {
        const m = MONTH_NAMES[monthKey];
        dateObj = new Date(y, m, d);
        if (textDate[4] !== undefined) {
          let hh = parseInt(textDate[4], 10);
          const mm = parseInt(textDate[5], 10);
          const ss = textDate[6] ? parseInt(textDate[6], 10) : 0;
          const ampm = textDate[7]?.toLowerCase();
          if (ampm === "pm" && hh < 12) hh += 12;
          if (ampm === "am" && hh === 12) hh = 0;
          timeObj = new Date(y, m, d, hh, mm, ss);
        }
      }
    }
  }

  // Check format: Month DD, YYYY (e.g. "Jan 15, 2024" or "January 15, 2024 02:30 PM")
  if (!dateObj) {
    const monthFirst = trimmed.match(
      /^([a-zA-Z]+)[-/ ]+(\d{1,2})(?:st|nd|rd|th)?[,-/ ]+(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?)?/i
    );
    if (monthFirst) {
      const monthKey = monthFirst[1].toLowerCase();
      const d = parseInt(monthFirst[2], 10);
      let y = parseInt(monthFirst[3], 10);
      if (y < 100) y += 2000;
      if (monthKey in MONTH_NAMES) {
        const m = MONTH_NAMES[monthKey];
        dateObj = new Date(y, m, d);
        if (monthFirst[4] !== undefined) {
          let hh = parseInt(monthFirst[4], 10);
          const mm = parseInt(monthFirst[5], 10);
          const ss = monthFirst[6] ? parseInt(monthFirst[6], 10) : 0;
          const ampm = monthFirst[7]?.toLowerCase();
          if (ampm === "pm" && hh < 12) hh += 12;
          if (ampm === "am" && hh === 12) hh = 0;
          timeObj = new Date(y, m, d, hh, mm, ss);
        }
      }
    }
  }

  // Fallback: native Date.parse
  if (!dateObj || isNaN(dateObj.getTime())) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }

  // If separate timeStr is supplied and valid
  if (timeStr && timeStr.trim()) {
    const tMatch = timeStr.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?/i);
    if (tMatch && dateObj) {
      let hh = parseInt(tMatch[1], 10);
      const mm = parseInt(tMatch[2], 10);
      const ss = tMatch[3] ? parseInt(tMatch[3], 10) : 0;
      const ampm = tMatch[4]?.toLowerCase();
      if (ampm === "pm" && hh < 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      timeObj = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hh, mm, ss);
    }
  }

  return { date: dateObj, time: timeObj };
}

/**
 * Main CSV parser function that accepts raw CSV text from PhonePe or Bank Statements
 * and returns structured ParsedTransaction objects.
 */
export function parseCSV(csvText: string): ParsedTransaction[] {
  const rows = parseCSVToRows(csvText);
  if (rows.length === 0) return [];

  const found = findHeaderRow(rows);
  if (!found) return [];

  const { headerIndex, columns } = found;
  const transactions: ParsedTransaction[] = [];

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check status if available
    if (columns.statusIdx !== -1 && columns.statusIdx < row.length) {
      const statusValue = row[columns.statusIdx];
      if (isFailedStatus(statusValue)) {
        continue;
      }
    }

    // Extract Date and Time
    const rawDate = columns.dateIdx < row.length ? row[columns.dateIdx] : "";
    const rawTime = columns.timeIdx !== -1 && columns.timeIdx < row.length ? row[columns.timeIdx] : undefined;
    const { date, time } = parseDateAndOptionalTime(rawDate, rawTime);
    if (!date || isNaN(date.getTime())) {
      continue;
    }

    // Extract Description
    const description =
      columns.descIdx < row.length ? row[columns.descIdx].trim() : "Transaction";
    if (!description && columns.amountIdx === -1 && columns.debitIdx === -1) {
      continue;
    }

    // Resolve Amount and Type
    let amount = 0;
    let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

    const hasDebitCredit =
      columns.debitIdx !== -1 &&
      columns.creditIdx !== -1 &&
      columns.debitIdx < row.length &&
      columns.creditIdx < row.length;

    if (hasDebitCredit) {
      const debitVal = parseAmountValue(row[columns.debitIdx]);
      const creditVal = parseAmountValue(row[columns.creditIdx]);

      if (debitVal > 0) {
        amount = debitVal;
        type = "EXPENSE";
      } else if (creditVal > 0) {
        amount = creditVal;
        type = "INCOME";
      } else if (columns.amountIdx !== -1 && columns.amountIdx < row.length) {
        amount = Math.abs(parseAmountValue(row[columns.amountIdx]));
      }
    } else if (columns.amountIdx !== -1 && columns.amountIdx < row.length) {
      const rawAmt = row[columns.amountIdx];
      const parsedAmt = parseAmountValue(rawAmt);
      amount = Math.abs(parsedAmt);

      // Check explicit type column
      let explicitType: string | null = null;
      if (columns.typeIdx !== -1 && columns.typeIdx < row.length) {
        explicitType = row[columns.typeIdx].trim().toLowerCase();
      }

      if (explicitType) {
        if (
          explicitType.includes("credit") ||
          explicitType === "cr" ||
          explicitType === "c" ||
          explicitType.includes("deposit") ||
          explicitType.includes("received")
        ) {
          type = "INCOME";
        } else if (
          explicitType.includes("transfer") ||
          explicitType === "trf"
        ) {
          type = "TRANSFER";
        } else {
          type = "EXPENSE";
        }
      } else if (parsedAmt < 0) {
        type = "EXPENSE";
      } else {
        // Check keywords in description or raw amount
        const descLower = description.toLowerCase();
        if (
          descLower.startsWith("received from") ||
          descLower.includes("cashback received") ||
          descLower.includes("refund from") ||
          descLower.includes("interest credited") ||
          descLower.includes("salary")
        ) {
          type = "INCOME";
        } else {
          type = "EXPENSE";
        }
      }
    } else if (columns.debitIdx !== -1 && columns.debitIdx < row.length) {
      const debitVal = parseAmountValue(row[columns.debitIdx]);
      if (debitVal > 0) {
        amount = debitVal;
        type = "EXPENSE";
      }
    }

    if (amount <= 0 || isNaN(amount)) {
      continue;
    }

    transactions.push({
      date,
      time: time ?? null,
      description: description || "Unknown transaction",
      amount,
      type,
    });
  }

  return transactions;
}
