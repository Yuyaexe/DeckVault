/**
 * Canonical allowlist for remote card/anime image hosts.
 * Match by exact hostname or registrable suffix (never substring).
 */
export const TRUSTED_IMAGE_HOST_SUFFIXES = [
  "ygoprodeck.com",
  "limitlesstcg.com",
  "digimoncard.io",
  "digimoncard.com",
  "world.digimoncard.com",
  "dbs-cardgame.com",
  "pokemontcg.io",
  "pokemoncard.io",
  "digitaloceanspaces.com",
  "cardtrader.com",
  "product-images.cardtrader.com",
  "tcgplayer.com",
  "static.wikia.nocookie.net",
  "wikia.nocookie.net",
  "wikimedia.org",
  "upload.wikimedia.org",
] as const;

/** Hostnames for Next.js `images.remotePatterns` (derived from suffix list). */
export const TRUSTED_IMAGE_REMOTE_HOSTNAMES = [
  "images.ygoprodeck.com",
  "images.pokemontcg.io",
  "images.digimoncard.io",
  "digimoncard.io",
  "world.digimoncard.com",
  "dbs-cardgame.com",
  "product-images.cardtrader.com",
  "tcgplayer.com",
  "static.wikia.nocookie.net",
  "upload.wikimedia.org",
] as const;

export function isTrustedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return TRUSTED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

export function isTrustedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    return isTrustedImageHost(url.hostname);
  } catch {
    return false;
  }
}
