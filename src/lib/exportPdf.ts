import { jsPDF } from "jspdf";
import type { Category, Expense } from "./types";
import { formatCurrency, formatDate } from "./format";

export interface PdfExportOptions {
  title: string;
  currency: string;
  categoriesById: Record<string, Category>;
  user: { name: string; email: string };
  dateRange?: { from: string; to: string };
}

const ORANGE = { r: 232, g: 117, b: 26 };
const GRID = { r: 210, g: 210, b: 210 };
const MARGIN = 36;
const MIN_ROW_H = 28;
const HEADER_H = 32;
const FONT = "helvetica";
const CELL_PAD_X = 8;
const CELL_PAD_Y = 9;
const LINE_H = 12;

const COLUMN_DEFS = [
  { label: "Date", weight: 0.11, align: "left" as const },
  { label: "Merchant", weight: 0.22, align: "left" as const },
  { label: "Category", weight: 0.15, align: "left" as const },
  { label: "Payment", weight: 0.13, align: "left" as const },
  { label: "Amount", weight: 0.14, align: "right" as const },
  { label: "Notes", weight: 0.25, align: "left" as const },
];

type Column = { label: string; width: number; align: "left" | "right" };

function buildColumns(contentWidth: number): Column[] {
  const cols = COLUMN_DEFS.map((def) => ({
    label: def.label,
    width: Math.floor(contentWidth * def.weight),
    align: def.align,
  }));
  const used = cols.reduce((sum, c) => sum + c.width, 0);
  cols[cols.length - 1].width += contentWidth - used;
  return cols;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatGeneratedAt(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function drawLogo(doc: jsPDF, centerX: number, topY: number, size: number) {
  const x = centerX - size / 2;
  doc.setFillColor(0, 102, 204);
  doc.roundedRect(x, topY, size, size, size * 0.22, size * 0.22, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2.2);
  doc.setLineCap("round");
  const sx = x + size * 0.22;
  const w = size * 0.56;
  doc.line(sx, topY + size * 0.34, sx + w, topY + size * 0.34);
  doc.line(sx, topY + size * 0.5, sx + w, topY + size * 0.5);
  doc.line(sx, topY + size * 0.66, sx + w * 0.58, topY + size * 0.66);
  doc.setFillColor(255, 255, 255);
  doc.circle(x + size * 0.69, topY + size * 0.66, size * 0.055, "F");
  doc.setDrawColor(0);
  doc.setLineCap("butt");
}

function wrapCell(doc: jsPDF, text: string, width: number): string[] {
  return doc.splitTextToSize(text || "—", Math.max(20, width - CELL_PAD_X * 2));
}

function drawCellText(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  width: number,
  rowH: number,
  align: "left" | "right",
) {
  const textW = width - CELL_PAD_X * 2;
  const blockH = lines.length * LINE_H;
  let textY = y + (rowH - blockH) / 2 + LINE_H - 2;
  for (const line of lines) {
    const tx =
      align === "right"
        ? x + width - CELL_PAD_X
        : x + CELL_PAD_X;
    doc.text(line, tx, textY, { align, maxWidth: textW });
    textY += LINE_H;
  }
}

/** Export a list of expenses to a downloadable PDF report. */
export function exportExpensesPdf(expenses: Expense[], options: PdfExportOptions): void {
  const { title, currency, categoriesById, user, dateRange } = options;
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const total = sorted.reduce((acc, e) => acc + e.amount, 0);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const columns = buildColumns(contentW);
  const tableX = MARGIN;
  let y = MARGIN;

  const drawTableHeader = () => {
    doc.setFillColor(ORANGE.r, ORANGE.g, ORANGE.b);
    doc.rect(tableX, y, contentW, HEADER_H, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    let cx = tableX;
    for (const col of columns) {
      const tx =
        col.align === "right"
          ? cx + col.width - CELL_PAD_X
          : cx + CELL_PAD_X;
      doc.text(col.label, tx, y + HEADER_H / 2 + 4, {
        align: col.align,
        maxWidth: col.width - CELL_PAD_X * 2,
      });
      cx += col.width;
    }
    doc.setTextColor(0);
    y += HEADER_H;
  };

  const drawDataRow = (cells: string[]) => {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    const wrapped = cells.map((cell, i) => wrapCell(doc, cell, columns[i].width));
    const rowH = Math.max(
      MIN_ROW_H,
      ...wrapped.map((lines) => lines.length * LINE_H + CELL_PAD_Y * 2),
    );

    if (y + rowH > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawTableHeader();
    }

    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.setLineWidth(0.75);
    let cx = tableX;
    for (let i = 0; i < columns.length; i++) {
      doc.rect(cx, y, columns[i].width, rowH, "S");
      drawCellText(doc, wrapped[i], cx, y, columns[i].width, rowH, columns[i].align);
      cx += columns[i].width;
    }
    y += rowH;
  };

  // —— Report header ——
  drawLogo(doc, pageW / 2, y, 56);
  y += 72;

  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text(title.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 28;

  doc.setFont(FONT, "normal");
  doc.setFontSize(11);
  doc.text(`Generated on: ${formatGeneratedAt()}`, pageW / 2, y, { align: "center" });
  y += 18;
  doc.text(`Name: ${user.name}`, pageW / 2, y, { align: "center" });
  y += 16;
  doc.text(`Email: ${user.email}`, pageW / 2, y, { align: "center" });
  y += 28;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.text(`Transactions Report — Total Entries: ${sorted.length}`, tableX, y);
  y += 18;
  doc.text(`Total Amount: ${formatCurrency(total, currency)}`, tableX, y);
  y += 18;

  if (dateRange) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(11);
    doc.text(`Period: ${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`, tableX, y);
    y += 22;
  } else {
    y += 8;
  }

  drawTableHeader();

  for (const e of sorted) {
    const cat = categoriesById[e.categoryId]?.name ?? "Uncategorized";
    drawDataRow([
      e.date,
      e.merchant,
      cat,
      e.paymentMethod ?? "—",
      formatCurrency(e.amount, currency),
      e.notes ?? "—",
    ]);
  }

  if (sorted.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("No transactions in this period.", tableX, y + 16);
  }

  const slug = new Date().toISOString().slice(0, 10);
  const rangeSlug = dateRange ? `-${dateRange.from}-to-${dateRange.to}` : "";
  downloadBlob(doc.output("blob"), `expenses${rangeSlug}-${slug}.pdf`);
}
