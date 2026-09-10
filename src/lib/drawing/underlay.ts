import type { Underlay } from "./types";

const cache = new Map<string, HTMLImageElement>();
const waiters = new Map<string, Set<() => void>>();

export function getUnderlayImage(src: string, onReady?: () => void): HTMLImageElement | null {
  const hit = cache.get(src);
  if (hit) {
    if (hit.complete && hit.naturalWidth > 0) return hit;
    if (onReady) {
      const set = waiters.get(src) ?? new Set();
      set.add(onReady);
      waiters.set(src, set);
    }
    return null;
  }
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    waiters.get(src)?.forEach((fn) => fn());
    waiters.delete(src);
  };
  img.onerror = () => waiters.delete(src);
  img.src = src;
  cache.set(src, img);
  if (onReady) {
    const set = waiters.get(src) ?? new Set();
    set.add(onReady);
    waiters.set(src, set);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.72): string {
  return canvas.toDataURL("image/jpeg", quality);
}

function fitCanvas(w: number, h: number, max = 1800): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export async function fileToUnderlay(file: File): Promise<Underlay> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return pdfToUnderlay(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const size = fitCanvas(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, size.w, size.h);
    const src = canvasToJpeg(canvas);
    const metersW = 12;
    const metersH = (metersW * size.h) / size.w;
    return { src, x: 0, y: 0, w: metersW, h: metersH, opacity: 0.38 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

async function pdfToUnderlay(file: File): Promise<Underlay> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, 1800 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const src = canvasToJpeg(canvas, 0.78);
  const metersW = 14;
  const metersH = (metersW * canvas.height) / canvas.width;
  return { src, x: 0, y: 0, w: metersW, h: metersH, opacity: 0.38 };
}
