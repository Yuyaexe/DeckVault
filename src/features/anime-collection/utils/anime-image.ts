import { cacheFetchUrl } from "@/lib/cache/image-fetch";
import { isTrustedImageHost } from "@/lib/cache/trusted-image-hosts";

const ANIME_IMAGE_SUFFIXES = ["wikia.nocookie.net", "wikimedia.org"] as const;

export function isAnimeExternalImage(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      ANIME_IMAGE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)) ||
      isTrustedImageHost(host)
    );
  } catch {
    return false;
  }
}

/** Same-origin proxy URL for Fandom / Wikimedia anime art. */
export function resolveAnimeImageSrc(src: string | null | undefined): string | null {
  if (!src?.trim()) return null;
  const trimmed = src.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (isAnimeExternalImage(trimmed)) {
    return cacheFetchUrl(trimmed);
  }
  return trimmed;
}
