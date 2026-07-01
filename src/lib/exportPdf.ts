import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { format } from "date-fns";
import type { Category, Expense } from "./types";
import { formatDate } from "./format";

export interface PdfExportOptions {
  title: string;
  currency: string;
  categoriesById: Record<string, Category>;
  user: { name: string; email: string };
  dateRange?: { from: string; to: string };
}

const PAGE_W_MM = 210;
const MARGIN_X = 20;
const LOGO_MM = 25;
const AMBER: [number, number, number] = [245, 158, 11];

const TABLE_HEAD = ["Date", "Merchant", "Category", "Payment", "Amount", "Notes"] as const;

/** PDF currency — Rs. prefix with en-IN grouping (matches KBS Harvesters export). */
export function formatPdfCurrency(amount: number, currency: string): string {
  if (currency === "INR") {
    return `Rs.${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${currency} ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Try PNG assets first; fall back to a canvas-rendered app icon. */
async function loadLogoDataUrl(): Promise<string | null> {
  for (const path of ["/icons/icon-512.png", "/icons/icon-192.png"]) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      return await blobToDataUrl(await res.blob());
    } catch {
      /* try next */
    }
  }
  try {
    return renderLogoDataUrl();
  } catch {
    return null;
  }
}

function renderLogoDataUrl(): string {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = "#0066cc";
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  const sx = size * 0.22;
  const w = size * 0.56;
  ctx.beginPath();
  ctx.moveTo(sx, size * 0.34);
  ctx.lineTo(sx + w, size * 0.34);
  ctx.moveTo(sx, size * 0.5);
  ctx.lineTo(sx + w, size * 0.5);
  ctx.moveTo(sx, size * 0.66);
  ctx.lineTo(sx + w * 0.58, size * 0.66);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size * 0.69, size * 0.66, size * 0.055, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL("image/png");
}

function drawHeaderBlock(
  doc: jsPDF,
  opts: {
    title: string;
    user: { name: string; email: string };
    entryCount: number;
    total: number;
    currency: string;
    dateRange?: { from: string; to: string };
  },
): number {
  const { title, user, entryCount, total, currency, dateRange } = opts;
  const centerX = PAGE_W_MM / 2;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title.toUpperCase(), centerX, 45, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated on: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, centerX, 55, {
    align: "center",
  });
  doc.text(`Name: ${user.name}`, centerX, 62, { align: "center" });
  doc.text(`Email: ${user.email}`, centerX, 68, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Transactions Report - Total Entries: ${entryCount}`, MARGIN_X, 76);
  doc.text(`Total Amount: ${formatPdfCurrency(total, currency)}`, MARGIN_X, 82);

  let tableStartY = 88;
  if (dateRange) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Period: ${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`, MARGIN_X, 88);
    tableStartY = 94;
  }

  return tableStartY;
}

/** Export filtered expenses to a PDF report (KBS Harvesters layout). */
export async function exportExpensesPdf(
  expenses: Expense[],
  options: PdfExportOptions,
): Promise<void> {
  const { title, currency, categoriesById, user, dateRange } = options;
  const sorted = [...expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  );
  const total = sorted.reduce((acc, e) => acc + e.amount, 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const logoDataUrl = await loadLogoDataUrl();
  if (logoDataUrl) {
    const logoX = (PAGE_W_MM - LOGO_MM) / 2;
    doc.addImage(logoDataUrl, "PNG", logoX, 10, LOGO_MM, LOGO_MM);
  }

  const tableStartY = drawHeaderBlock(doc, {
    title,
    user,
    entryCount: sorted.length,
    total,
    currency,
    dateRange,
  });

  const body = sorted.map((e) => [
    e.date,
    e.merchant,
    categoriesById[e.categoryId]?.name ?? "Uncategorized",
    e.paymentMethod || "-",
    formatPdfCurrency(e.amount, currency),
    e.notes || "-",
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [TABLE_HEAD as unknown as string[]],
    body: body.length > 0 ? body : [["—", "No transactions", "—", "—", "—", "—"]],
    theme: "grid",
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: [0, 0, 0],
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
      cellPadding: 2,
    },
    headStyles: {
      fillColor: AMBER,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      halign: "left",
    },
    columnStyles: {
      4: { halign: "right" },
    },
  });

  const dateSlug = format(new Date(), "yyyy-MM-dd");
  const rangeSlug = dateRange ? `_${dateRange.from}_to_${dateRange.to}` : "";
  doc.save(`Expense_Transactions${rangeSlug}_${dateSlug}.pdf`);
}
