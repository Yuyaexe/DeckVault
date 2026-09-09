import { readProxyCustomImageBlob, writeProxyCustomImageBlob } from "@/lib/cache/idb";

export const PROXY_IMAGE_REF = /^@img:([a-z0-9]{8})$/i;

const LEGACY_STORAGE_KEY = "deckvault-proxy-custom-images";
const DATA_URL_IN_TEXT = /data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=]+/gi;

const objectUrlCache = new Map<string, string>();
const dataUrlCache = new Map<string, string>();

let legacyMigrationStarted = false;

function proxyImageId(ref: string): string | null {
  return ref.trim().match(PROXY_IMAGE_REF)?.[1]?.toLowerCase() ?? null;
}

async function sourceToBlob(source: string): Promise<Blob> {
  const response = await fetch(source);
  return response.blob();
}

async function compressImageBlob(blob: Blob, maxWidth = 900, quality = 0.82): Promise<Blob> {
  if (typeof document === "undefined") return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
    });
    return compressed ?? blob;
  } catch {
    return blob;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

function cacheResolvedImage(id: string, blob: Blob, dataUrl: string): string {
  dataUrlCache.set(id, dataUrl);
  const previous = objectUrlCache.get(id);
  if (previous?.startsWith("blob:")) {
    URL.revokeObjectURL(previous);
  }
  objectUrlCache.set(id, URL.createObjectURL(blob));
  return dataUrl;
}

async function migrateLegacySessionStorage(): Promise<void> {
  if (legacyMigrationStarted || typeof sessionStorage === "undefined") return;
  legacyMigrationStarted = true;

  try {
    const raw = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string>;
    await Promise.all(
      Object.entries(map).map(async ([id, dataUrl]) => {
        if (!dataUrl.startsWith("data:")) return;
        const blob = await compressImageBlob(await sourceToBlob(dataUrl));
        await writeProxyCustomImageBlob(id, blob);
        cacheResolvedImage(id, blob, dataUrl);
      })
    );
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Best-effort migration from the old sessionStorage format.
  }
}

export function isProxyImageRef(value: string): boolean {
  return PROXY_IMAGE_REF.test(value.trim());
}

/** Persist a custom image in IndexedDB and return a short `@img:` token. */
export async function storeProxyCustomImage(source: string): Promise<string> {
  await migrateLegacySessionStorage();

  for (const [id, cached] of dataUrlCache.entries()) {
    if (cached === source) return `@img:${id}`;
  }

  const blob = await compressImageBlob(await sourceToBlob(source));
  const dataUrl = await blobToDataUrl(blob);

  for (const [id, cached] of dataUrlCache.entries()) {
    if (cached === dataUrl) return `@img:${id}`;
  }

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  await writeProxyCustomImageBlob(id, blob);
  cacheResolvedImage(id, blob, dataUrl);
  return `@img:${id}`;
}

export async function resolveProxyCustomImage(ref: string): Promise<string | null> {
  await migrateLegacySessionStorage();

  const id = proxyImageId(ref);
  if (!id) return null;

  const cachedData = dataUrlCache.get(id);
  if (cachedData) return cachedData;

  const blob = await readProxyCustomImageBlob(id);
  if (!blob) return null;

  const dataUrl = await blobToDataUrl(blob);
  cacheResolvedImage(id, blob, dataUrl);
  return dataUrl;
}

/** Sync preview URL — uses in-memory cache populated by store/resolve/preload. */
export function resolveInlineImageUrl(url: string): string {
  const id = proxyImageId(url);
  if (!id) return url;
  return objectUrlCache.get(id) ?? dataUrlCache.get(id) ?? url;
}

/** Warm the in-memory cache for `@img:` tokens found in deck text. */
export async function preloadProxyDeckCustomImages(deckText: string): Promise<void> {
  const ids = [
    ...new Set([...deckText.matchAll(/@img:([a-z0-9]{8})/gi)].map((match) => match[1].toLowerCase())),
  ];
  await Promise.all(ids.map((id) => resolveProxyCustomImage(`@img:${id}`)));
}

/** Expand short refs only when a consumer needs the full image payload (PDF / server). */
export async function expandProxyDeckCustomImages(deckText: string): Promise<string> {
  await preloadProxyDeckCustomImages(deckText);

  const parts = deckText.split(/(@img:[a-z0-9]{8})/gi);
  const resolvedParts = await Promise.all(
    parts.map(async (part) => {
      if (!isProxyImageRef(part)) return part;
      return (await resolveProxyCustomImage(part)) ?? part;
    })
  );
  return resolvedParts.join("");
}

/** Resolve `@img:` fields on slots for binder preview without bloating the API request. */
export async function hydrateProxySlotImageUrls<T extends { imageUrl: string | null }>(
  slots: T[]
): Promise<T[]> {
  return Promise.all(
    slots.map(async (slot) => {
      if (!slot.imageUrl || !isProxyImageRef(slot.imageUrl)) return slot;
      const resolved = await resolveProxyCustomImage(slot.imageUrl);
      return resolved ? { ...slot, imageUrl: resolved } : slot;
    })
  );
}

/** Replace embedded data URLs with short `@img:` tokens in deck list text. */
export async function compactProxyDeckCustomImages(deckText: string): Promise<string> {
  if (!deckText.includes("data:image/")) return deckText;

  const matches = [...deckText.matchAll(DATA_URL_IN_TEXT)];
  let next = deckText;
  for (const match of matches) {
    const dataUrl = match[0];
    const ref = await storeProxyCustomImage(dataUrl);
    next = next.replace(dataUrl, ref);
  }
  return next;
}

/** Store bulky inline images and return a deck-list-friendly reference. */
export async function toInlineDeckImageRef(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (isProxyImageRef(trimmed)) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return storeProxyCustomImage(trimmed);
  }
  return trimmed;
}
