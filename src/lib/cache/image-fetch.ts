import { isTrustedImageUrl } from "@/lib/cache/trusted-image-hosts";

/** Same-origin fetch URL for caching external card art (avoids CORS). */
export function cacheFetchUrl(remoteUrl: string): string {
  if (remoteUrl.startsWith("/")) return remoteUrl;
  if (isTrustedImageUrl(remoteUrl)) {
    return `/api/proxy-image?url=${encodeURIComponent(remoteUrl)}`;
  }
  return remoteUrl;
}
