import assert from "node:assert/strict";
import test from "node:test";
import { parsePdfStatement } from "../lib/parsers/pdf";

function createTextPdf(): ArrayBuffer {
  const content = [
    "BT /F1 10 Tf",
    "1 0 0 1 40 700 Tm (Date IST) Tj",
    "1 0 0 1 150 700 Tm (Description) Tj",
    "1 0 0 1 400 700 Tm (Amount INR) Tj",
    "1 0 0 1 40 680 Tm (10/09/2026) Tj",
    "1 0 0 1 150 680 Tm (Corner Cafe) Tj",
    "1 0 0 1 400 680 Tm (150.00) Tj",
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const bytes = new TextEncoder().encode(pdf);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

test("PDF parser extracts a supported text transaction table", async () => {
  const transactions = await parsePdfStatement(createTextPdf());
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].description, "Corner Cafe");
  assert.equal(transactions[0].amount, 150);
  assert.equal(transactions[0].type, "EXPENSE");
});

test("PDF parser rejects files without the PDF signature", async () => {
  await assert.rejects(() => parsePdfStatement(new TextEncoder().encode("not a pdf").buffer), /not a valid PDF/);
});
