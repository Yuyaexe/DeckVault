import { jsPDF } from "jspdf";
import {
  CARDS_PER_PAGE,
  CARD_SIZE_PRESETS,
  PDF_COLS,
  PDF_ROWS,
  type CardSizePreset,
} from "@/lib/proxy-print/types";

const A4_W_MM = 210;
const A4_H_MM = 297;
const DEFAULT_MARGIN_MM = 12;
const DEFAULT_GAP_MM = 1.2;

function mmToPx(mm: number, dpi: number): number {
  return Math.max(1, Math.round((mm * dpi) / 25.4));
}

function layoutCells(
  dpi: number,
  cardWmm: number,
  cardHmm: number,
  cardsGlued: boolean
) {
  const marginMm = cardsGlued ? 0 : DEFAULT_MARGIN_MM;
  const gapMm = cardsGlued ? 0 : DEFAULT_GAP_MM;
  const pageW = mmToPx(A4_W_MM, dpi);
  const pageH = mmToPx(A4_H_MM, dpi);
  const m = mmToPx(marginMm, dpi);
  let g = gapMm <= 0 ? 0 : Math.max(1, mmToPx(gapMm, dpi));
  let cw = mmToPx(cardWmm, dpi);
  let ch = Math.max(1, Math.round((cw * cardHmm) / cardWmm));

  let gridW = PDF_COLS * cw + (PDF_COLS - 1) * g;
  let gridH = PDF_ROWS * ch + (PDF_ROWS - 1) * g;
  const availW = pageW - 2 * m;
  const availH = pageH - 2 * m;

  if (gridW > availW || gridH > availH) {
    const scale = Math.min(availW / gridW, availH / gridH);
    cw = Math.max(1, Math.floor(cw * scale));
    ch = Math.max(1, Math.round((cw * cardHmm) / cardWmm));
    g = gapMm > 0 ? Math.max(1, Math.floor(g * scale)) : 0;
    gridW = PDF_COLS * cw + (PDF_COLS - 1) * g;
    gridH = PDF_ROWS * ch + (PDF_ROWS - 1) * g;
  }

  const offX = m + Math.max(0, Math.floor((availW - gridW) / 2));
  const offY = m + Math.max(0, Math.floor((availH - gridH) / 2));
  return { pageW, pageH, offX, offY, g, cw, ch };
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function loadImageDataUrl(remote: string): Promise<string | null> {
  try {
    const fetchUrl =
      remote.startsWith("blob:") ||
      remote.startsWith("data:") ||
      remote.startsWith("/")
        ? remote
        : `/api/proxy-image?url=${encodeURIComponent(remote)}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function placeholderDataUrl(cw: number, ch: number, label: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#dcdcdc";
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "#3c3c3c";
  ctx.font = "12px sans-serif";
  ctx.fillText(label.slice(0, 28), 8, ch / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface BuildPdfProgress {
  current: number;
  total: number;
}

export async function buildProxyPdf(options: {
  imageUrls: string[];
  cardSize: CardSizePreset;
  dpi: number;
  cardsGlued: boolean;
  onProgress?: (p: BuildPdfProgress) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { imageUrls, cardSize, dpi, cardsGlued, onProgress, signal } = options;
  const preset = CARD_SIZE_PRESETS[cardSize];
  const { pageW, pageH, offX, offY, g, cw, ch } = layoutCells(
    dpi,
    preset.w,
    preset.h,
    cardsGlued
  );

  const imageCache = new Map<number, string>();
  const totalSteps = imageUrls.length;
  let step = 0;

  const getCellImage = async (index: number, label: string): Promise<string> => {
    if (imageCache.has(index)) return imageCache.get(index)!;
    const remote = imageUrls[index];
    let dataUrl: string | null = null;
    if (remote) {
      dataUrl = await loadImageDataUrl(remote);
    }
    if (!dataUrl) dataUrl = placeholderDataUrl(cw, ch, label);
    imageCache.set(index, dataUrl);
    step += 1;
    onProgress?.({ current: step, total: totalSteps });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return dataUrl;
  };

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [pageW, pageH],
    compress: true,
  });

  const pxPerMm = dpi / 25.4;

  for (let start = 0; start < imageUrls.length; start += CARDS_PER_PAGE) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (start > 0) pdf.addPage([pageW, pageH], "portrait");

    const chunkLen = Math.min(CARDS_PER_PAGE, imageUrls.length - start);
    for (let i = 0; i < chunkLen; i++) {
      const globalIndex = start + i;
      const row = Math.floor(i / PDF_COLS);
      const col = i % PDF_COLS;
      const x = offX + col * (cw + g);
      const y = offY + row * (ch + g);
      const dataUrl = await getCellImage(globalIndex, `Card ${globalIndex + 1}`);
      pdf.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), x, y, cw, ch, undefined, "FAST");
    }
  }

  pdf.setProperties({ title: "DeckVault Proxies" });
  return pdf.output("blob");
}

export function previewLayoutText(
  cardSize: CardSizePreset,
  cardsGlued: boolean,
  locale: "en" | "pt-BR"
): string {
  const { w, h } = CARD_SIZE_PRESETS[cardSize];
  const layout =
    locale === "pt-BR"
      ? cardsGlued
        ? "coladas"
        : "separadas"
      : cardsGlued
        ? "glued"
        : "separated";
  return locale === "pt-BR"
    ? `Grelha 3×3 A4 — carta ~${w} × ${h} mm (${layout})`
    : `3×3 A4 grid — card ~${w} × ${h} mm (${layout})`;
}
