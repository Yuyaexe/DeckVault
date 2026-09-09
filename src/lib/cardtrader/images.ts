/** CardTrader placeholder when no scan is uploaded — not usable card art. */
export function isCardTraderPlaceholderImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/fallbacks\//i.test(url) || /card_uploader\/preview\.png/i.test(url);
}

export function isCardTraderHostedImage(url: string | null | undefined): boolean {
  if (!url || isCardTraderPlaceholderImage(url)) return false;
  return /cardtrader\.com|product-images\.cardtrader/i.test(url);
}

export function normalizeCardTraderImageUrl(url: string | null | undefined): string | null {
  if (!isCardTraderHostedImage(url)) return null;
  return url!.trim();
}
