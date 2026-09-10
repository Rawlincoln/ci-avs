import { buildSchedule, type Schedule } from "./bom";
import { formatLength } from "./geometry";
import { CABLE_COLOR, INK, INK_MUTED, PAPER } from "./palette";
import { fitDrawing, paintDeviceGlyph, renderExportCanvas } from "./render";
import { sheetKey } from "./sheetKey";
import { useStore } from "./store";
import { type CableKind, type Drawing, type Viewport, type ViewMode } from "./types";

const A3 = { w: 420, h: 297 };
const MARGIN = 14;
const FOOTER = 12;
const KEY_MM = 72;
const FRAME = 6;
const PAPER_RGB = hexRgb(PAPER);
const INK_RGB = hexRgb(INK);
const MUTED_RGB = hexRgb(INK_MUTED);
const RULE_RGB: [number, number, number] = [214, 207, 194];
const BAND_RGB: [number, number, number] = [232, 226, 214];
const ZEBRA_RGB: [number, number, number] = [237, 232, 222];
const KEY_BG = "#efeae1";
const BRAND = "CI AVS";

type PdfDoc = import("jspdf").jsPDF;

export function fileBase(drawing: Drawing): string {
  const raw = drawing.meta.drawingNo || drawing.name || "ci-avs";
  return raw.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "ci-avs";
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export function canvasWrapSize() {
  const wrap = document.querySelector("[data-canvas-wrap]");
  if (!wrap) return { width: 800, height: 600 };
  const r = wrap.getBoundingClientRect();
  return { width: r.width, height: r.height };
}

export function downloadPng() {
  const s = useStore.getState();
  const { width, height } = canvasWrapSize();
  const keyW = 300;
  const canvas = composeSheet(s.drawing(), s.viewport, width, height, keyW, s.viewMode, 2);
  canvas.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(blob, `${fileBase(s.drawing())}.png`);
  }, "image/png");
}

export function downloadJson() {
  const drawing = useStore.getState().drawing();
  const blob = new Blob([JSON.stringify(drawing, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${fileBase(drawing)}.json`);
}

export async function downloadPdf(kind: "set" | "3d" = "set") {
  const blob = await buildPdfBlob(kind);
  const base = fileBase(useStore.getState().drawing());
  triggerDownload(blob, kind === "3d" ? `${base}-3d.pdf` : `${base}.pdf`);
}

export async function buildPdfBlob(kind: "set" | "3d" = "set"): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const s = useStore.getState();
  const drawing = s.drawing();
  const schedule = buildSchedule(drawing);

  const planMmW = A3.w - FRAME * 2 - KEY_MM;
  const planMmH = A3.h - FRAME * 2;
  const sheetW = 1680;
  const sheetH = Math.round((sheetW * planMmH) / planMmW);
  const keyW = Math.round((sheetW * KEY_MM) / planMmW);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
  doc.setProperties({
    title: `${drawing.meta.drawingNo} — ${drawing.meta.title}${kind === "3d" ? " — 3D" : ""}`,
    subject: drawing.meta.project,
    author: drawing.meta.author || BRAND,
    creator: BRAND,
    keywords: "AV, cable schedule, shop drawing, 3D",
  });

  const addView = (viewMode: ViewMode) => {
    const fitted = fitDrawing(drawing, sheetW, sheetH, viewMode);
    const cam = {
      ...fitted,
      rotation: viewMode === "plan" ? s.viewport.rotation : 0,
      yaw: s.viewport.yaw,
      pitch: s.viewport.pitch,
    };
    const sheet = composeSheet(drawing, cam, sheetW, sheetH, keyW, viewMode, 2);
    paintPaper(doc);
    doc.addImage(sheet, "PNG", FRAME, FRAME, planMmW + KEY_MM, planMmH, undefined, "FAST");
    strokeSheet(doc);
  };

  if (kind === "3d") {
    addView("iso");
  } else {
    addView("plan");
    doc.addPage("a3", "landscape");
    addView("iso");
    doc.addPage("a3", "landscape");
    paintPaper(doc);
    drawSchedulePages(doc, drawing, schedule);
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, drawing, i, total);
  }

  return doc.output("blob");
}

function composeSheet(
  drawing: Drawing,
  cam: Viewport,
  planW: number,
  planH: number,
  keyW: number,
  viewMode: ViewMode,
  dpr: number,
): HTMLCanvasElement {
  const rows = sheetKey(drawing);
  const keyH = Math.max(planH, 48 + rows.length * 28);
  const plan = renderExportCanvas(drawing, cam, planW, planH, viewMode, dpr);
  const key = renderSheetKeyCanvas(drawing, keyW, keyH, dpr);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((planW + keyW) * dpr));
  canvas.height = Math.max(1, Math.round(keyH * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return plan;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(plan, 0, 0);
  ctx.drawImage(key, Math.round(planW * dpr), 0);
  ctx.fillStyle = "rgba(26, 25, 22, 0.16)";
  ctx.fillRect(Math.round(planW * dpr) - dpr, 0, dpr, canvas.height);
  return canvas;
}

function renderSheetKeyCanvas(drawing: Drawing, width: number, height: number, dpr = 2): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = KEY_BG;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = INK_MUTED;
  ctx.font = '500 10px "IBM Plex Sans", system-ui, sans-serif';
  ctx.textBaseline = "top";
  ctx.fillText("ON THIS SHEET", 14, 14);

  const rows = sheetKey(drawing);
  const top = 36;
  const n = Math.max(1, rows.length);
  const rowH = Math.min(28, Math.max(18, (height - top - 10) / n));
  const glyph = Math.min(24, rowH - 4);
  const fontPx = Math.max(10, Math.min(12, rowH * 0.45));
  ctx.font = `500 ${fontPx}px "IBM Plex Mono", ui-monospace, monospace`;
  const tagCol = Math.min(
    64,
    Math.max(36, ...rows.map((r) => ctx.measureText(r.tag).width + 4)),
  );

  const stamp = document.createElement("canvas");
  const stampCss = 28;
  stamp.width = Math.round(stampCss * dpr);
  stamp.height = Math.round(stampCss * dpr);

  rows.forEach((row, i) => {
    const y = top + i * rowH;
    const gy = y + (rowH - glyph) / 2;
    const gctx = stamp.getContext("2d");
    if (gctx) {
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.fillStyle = PAPER;
      gctx.fillRect(0, 0, stampCss, stampCss);
      paintDeviceGlyph(gctx, row.device, row.mountKind, stampCss);
      ctx.drawImage(stamp, 12, gy, glyph, glyph);
    }
    ctx.strokeStyle = "rgba(26, 25, 22, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(12.5, gy + 0.5, glyph - 1, glyph - 1);

    const mid = y + rowH / 2;
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.font = `500 ${fontPx}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.fillText(clipCanvas(ctx, row.tag, tagCol), 16 + glyph, mid);

    ctx.fillStyle = INK_MUTED;
    ctx.font = `400 ${fontPx}px "IBM Plex Sans", system-ui, sans-serif`;
    const nameX = 20 + glyph + tagCol;
    const nameMax = width - nameX - (row.mount ? 32 : 14);
    ctx.fillText(clipCanvas(ctx, row.name, nameMax), nameX, mid);

    if (row.mount) {
      ctx.fillStyle = "#9a948a";
      ctx.font = `500 ${Math.max(8, fontPx - 1)}px "IBM Plex Sans", system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(row.mount.toUpperCase(), width - 12, mid);
      ctx.textAlign = "left";
    }
  });
  return canvas;
}

function clipCanvas(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1);
  return `${s}…`;
}

function paintPaper(doc: PdfDoc) {
  doc.setFillColor(...PAPER_RGB);
  doc.rect(0, 0, A3.w, A3.h, "F");
}

function strokeSheet(doc: PdfDoc) {
  doc.setDrawColor(...INK_RGB);
  doc.setLineWidth(0.35);
  doc.rect(6, 6, A3.w - 12, A3.h - 12);
}

function drawFooter(doc: PdfDoc, drawing: Drawing, page: number, total: number) {
  const y = A3.h - 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(BRAND, MARGIN, y);
  doc.text(drawing.meta.project, A3.w / 2, y, { align: "center" });
  doc.text(`${page} / ${total}`, A3.w - MARGIN, y, { align: "right" });
}

function drawSchedulePages(doc: PdfDoc, drawing: Drawing, schedule: Schedule) {
  const unit = drawing.meta.unit;
  let y = MARGIN;

  y = header(doc, y, "PULL SCHEDULE", drawing);
  y = sectionLabel(doc, y, "Cable summary", drawing);

  const summaryCols: Col[] = [
    { key: "type", label: "Type", w: 42 },
    { key: "spec", label: "Spec", w: 92 },
    { key: "runs", label: "Runs", w: 28, align: "right" },
    { key: "route", label: "Route", w: 48, align: "right" },
    { key: "pull", label: "Pull", w: 40, align: "right" },
  ];
  const summaryRows: Row[] = schedule.cables.map((row) => ({
    type: row.label,
    spec: row.spec,
    runs: String(row.count),
    route: formatLength(row.length, unit),
    pull: `${row.pull} m`,
    kind: row.kind,
  }));
  y = table(doc, y, summaryCols, summaryRows, drawing);

  y += 4;
  y = ensureY(doc, drawing, y, 10);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(
    `Route ${formatLength(schedule.totalCable, unit)}   ·   Pull ${schedule.totalPull} m   ·   cut = ceil(1.15 x route + 2 m)`,
    MARGIN,
    y,
  );
  y += 10;

  y = sectionLabel(doc, y, "Tagged runs", drawing);
  const runCols: Col[] = [
    { key: "tag", label: "Tag", w: 70 },
    { key: "type", label: "Type", w: 48 },
    { key: "spec", label: "Spec", w: 92 },
    { key: "route", label: "Route", w: 48, align: "right" },
    { key: "cut", label: "Cut", w: 40, align: "right" },
  ];
  const runRows: Row[] = schedule.cables.flatMap((row) =>
    row.runs.map((run) => ({
      tag: run.label,
      type: row.label,
      spec: row.spec,
      route: formatLength(run.length, unit),
      cut: `${run.pull} m`,
      kind: row.kind,
    })),
  );
  y = table(
    doc,
    y,
    runCols,
    runRows.length
      ? runRows
      : [{ tag: "-", type: "No cable runs", spec: "", route: "", cut: "" }],
    drawing,
  );

  y += 8;
  y = sectionLabel(doc, y, "Devices", drawing);
  if (!schedule.devices.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_RGB);
    doc.text("No devices placed.", MARGIN, y);
    return;
  }

  const chipW = 64;
  const chipH = 10;
  const gap = 3;
  let x = MARGIN;
  for (const d of schedule.devices) {
    if (x + chipW > A3.w - MARGIN + 0.5) {
      x = MARGIN;
      y += chipH + gap;
    }
    const prevY = y;
    y = ensureY(doc, drawing, y, chipH + 2);
    if (y < prevY) x = MARGIN;
    doc.setFillColor(...BAND_RGB);
    doc.roundedRect(x, y - 6.5, chipW, chipH, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK_RGB);
    doc.text(String(d.count), x + 3.2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED_RGB);
    doc.text(clip(doc, d.label, chipW - 14), x + 10, y);
    x += chipW + gap;
  }
}

function header(doc: PdfDoc, y: number, heading: string, drawing: Drawing, note?: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK_RGB);
  doc.text(BRAND, MARGIN, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_RGB);
  doc.text(drawing.meta.drawingNo, A3.w - MARGIN, y + 2, { align: "right" });

  doc.setDrawColor(...INK_RGB);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 6, A3.w - MARGIN, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK_RGB);
  doc.text(note ? `${heading}  (${note})` : heading, MARGIN, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_RGB);
  doc.text(drawing.meta.title, MARGIN, y + 23);
  doc.text(`${drawing.meta.scaleLabel}   ${drawing.meta.date}`, A3.w - MARGIN, y + 16, { align: "right" });
  return y + 32;
}

function sectionLabel(doc: PdfDoc, y: number, label: string, drawing: Drawing): number {
  y = ensureY(doc, drawing, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(label.toUpperCase(), MARGIN, y);
  return y + 5;
}

type Col = { key: string; label: string; w: number; align?: "left" | "right" };
type Row = Record<string, string> & { kind?: CableKind };

function table(doc: PdfDoc, y: number, cols: Col[], rows: Row[], drawing: Drawing): number {
  const rowH = 7;
  const tableW = cols.reduce((n, c) => n + c.w, 0);
  const x0 = MARGIN;
  let pageTop = y;

  const paintHead = () => {
    pageTop = y;
    doc.setFillColor(...BAND_RGB);
    doc.rect(x0, y, tableW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    let x = x0;
    for (const col of cols) {
      const label = col.label.toUpperCase();
      if (col.align === "right") doc.text(label, x + col.w - 3, y + 4.8, { align: "right" });
      else doc.text(label, x + 3, y + 4.8);
      x += col.w;
    }
    y += rowH;
  };

  const strokeBlock = () => {
    doc.setDrawColor(...INK_RGB);
    doc.setLineWidth(0.25);
    doc.rect(x0, pageTop, tableW, y - pageTop);
  };

  paintHead();

  rows.forEach((row, i) => {
    if (y + rowH > A3.h - FOOTER) {
      strokeBlock();
      doc.addPage("a3", "landscape");
      paintPaper(doc);
      y = header(doc, MARGIN, "PULL SCHEDULE", drawing, "continued");
      paintHead();
    }
    if (i % 2 === 1) {
      doc.setFillColor(...ZEBRA_RGB);
      doc.rect(x0, y, tableW, rowH, "F");
    }
    doc.setDrawColor(...RULE_RGB);
    doc.setLineWidth(0.15);
    doc.line(x0, y + rowH, x0 + tableW, y + rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK_RGB);
    let x = x0;
    for (const col of cols) {
      const text = row[col.key] ?? "";
      if (col.key === "type" && row.kind) {
        const [r, g, b] = hexRgb(CABLE_COLOR[row.kind]);
        doc.setFillColor(r, g, b);
        doc.circle(x + 5, y + 3.6, 1.4, "F");
        doc.setTextColor(...INK_RGB);
        doc.text(clip(doc, text, col.w - 12), x + 9, y + 4.8);
      } else if (col.align === "right") {
        doc.text(clip(doc, text, col.w - 6), x + col.w - 3, y + 4.8, { align: "right" });
      } else {
        doc.text(clip(doc, text, col.w - 6), x + 3, y + 4.8);
      }
      x += col.w;
    }
    y += rowH;
  });

  strokeBlock();
  return y + 2;
}

function ensureY(doc: PdfDoc, drawing: Drawing, y: number, needed: number): number {
  if (y + needed <= A3.h - FOOTER) return y;
  doc.addPage("a3", "landscape");
  paintPaper(doc);
  return header(doc, MARGIN, "PULL SCHEDULE", drawing, "continued");
}

function clip(doc: PdfDoc, text: string, width: number): string {
  if (!text) return "";
  if (doc.getTextWidth(text) <= width) return text;
  let s = text;
  while (s.length > 1 && doc.getTextWidth(`${s}...`) > width) s = s.slice(0, -1);
  return `${s}...`;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
