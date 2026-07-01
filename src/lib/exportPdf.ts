import { jsPDF } from "jspdf";
import type { Category, Expense } from "./types";
import { formatCurrency, formatDate } from "./format";

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  currency: string;
  categoriesById: Record<string, Category>;
  /** When set, shown in the PDF header. */
  dateRange?: { from: string; to: string };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a list of expenses to a downloadable PDF report. */
export function exportExpensesPdf(expenses: Expense[], options: PdfExportOptions): void {
  const { title, subtitle, currency, categoriesById, dateRange } = options;
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const total = sorted.reduce((acc, e) => acc + e.amount, 0);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  const ensureSpace = (needed: number) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (subtitle) {
    doc.text(subtitle, margin, y);
    y += 14;
  }
  if (dateRange) {
    doc.text(`${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`, margin, y);
    y += 14;
  }
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 20;
  doc.setTextColor(0);

  // Summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total: ${formatCurrency(total, currency)}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${sorted.length} transaction${sorted.length === 1 ? "" : "s"}`, margin + 160, y);
  y += 24;

  // Table header
  const cols = {
    date: margin,
    merchant: margin + 72,
    category: margin + 220,
    amount: pageW - margin,
  };

  const drawTableHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Date", cols.date, y);
    doc.text("Merchant", cols.merchant, y);
    doc.text("Category", cols.category, y);
    doc.text("Amount", cols.amount, y, { align: "right" });
    y += 6;
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
  };

  drawTableHeader();

  for (const e of sorted) {
    ensureSpace(28);
    if (y === margin) drawTableHeader();

    const cat = categoriesById[e.categoryId]?.name ?? "Uncategorized";
    const merchant =
      e.merchant.length > 28 ? `${e.merchant.slice(0, 26)}…` : e.merchant;
    const catShort = cat.length > 16 ? `${cat.slice(0, 14)}…` : cat;

    doc.setFontSize(9);
    doc.text(formatDate(e.date), cols.date, y);
    doc.text(merchant, cols.merchant, y);
    doc.text(catShort, cols.category, y);
    doc.setFont("helvetica", "bold");
    doc.text(`−${formatCurrency(e.amount, currency)}`, cols.amount, y, { align: "right" });
    doc.setFont("helvetica", "normal");

    if (e.paymentMethod || e.notes) {
      y += 11;
      doc.setFontSize(8);
      doc.setTextColor(120);
      const detail = [e.paymentMethod, e.notes].filter(Boolean).join(" · ");
      const clipped = detail.length > 90 ? `${detail.slice(0, 88)}…` : detail;
      doc.text(clipped, cols.merchant, y);
      doc.setTextColor(0);
    }

    y += 18;
  }

  if (sorted.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("No transactions in this period.", margin, y);
  }

  const slug = new Date().toISOString().slice(0, 10);
  const rangeSlug =
    dateRange ? `-${dateRange.from}-to-${dateRange.to}` : "";
  downloadBlob(doc.output("blob"), `expenses${rangeSlug}-${slug}.pdf`);
}
