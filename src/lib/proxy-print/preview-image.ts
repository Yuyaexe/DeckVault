import { isProxyImageRef, resolveInlineImageUrl, resolveProxyCustomImage } from "@/lib/proxy-print/custom-images";

/** Only local/data URLs load without the image proxy (avoids CDN hotlink / MIME issues). */
export function canLoadPreviewDirect(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/");
}

/** Inline image reference after `|` or `@` on a deck line. */
export const INLINE_IMAGE_URL =
  /(?:https?:\/\/\S+|data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=]+|blob:\S+|@img:[a-z0-9]{8})/i;

export function isInlineImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return isProxyImageRef(trimmed) || INLINE_IMAGE_URL.test(trimmed);
}

/** True user uploads — not catalog print URLs written into the deck list. */
export function isUserUploadedCustomImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    isProxyImageRef(trimmed)
  );
}

/**
 * Browser-safe preview src.
 * Remote CDNs go through `/api/proxy-image` (TCGPlayer / digimoncard hotlink + MIME quirks).
 * `@img:` tokens resolve from the in-memory IndexedDB cache when warm.
 */
export function previewImageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (isProxyImageRef(url)) {
    const resolved = resolveInlineImageUrl(url);
    if (resolved !== url && canLoadPreviewDirect(resolved)) return resolved;
    return null;
  }
  const resolved = resolveInlineImageUrl(url);
  if (canLoadPreviewDirect(resolved)) return resolved;
  try {
    new URL(resolved);
  } catch {
    return null;
  }
  return `/api/proxy-image?url=${encodeURIComponent(resolved)}`;
}

/** Async preview src — waits for `@img:` IndexedDB hydration. */
export async function resolvePreviewImageSrc(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (isProxyImageRef(url)) {
    const dataUrl = await resolveProxyCustomImage(url);
    return dataUrl ? previewImageSrc(dataUrl) : null;
  }
  return previewImageSrc(url);
}
