/** Parse Yu-Gi-Oh! set codes like LART-EN046, MVP1-EN052, ALIN-EN004. */

export function yugiohSetPrefix(setCode: string | null | undefined): string | null {
  if (!setCode?.trim()) return null;
  const match = setCode.trim().toUpperCase().match(/^([A-Z0-9]+)-/);
  return match?.[1] ?? null;
}

/** Numeric / EN suffix variants for matching CardTrader collector numbers (#046, EN046). */
export function yugiohCardNumberVariants(code: string | null | undefined): string[] {
  if (!code?.trim()) return [];
  const trimmed = code.trim().toLowerCase().replace(/\s/g, "").replace(/^#/, "");
  const out = new Set<string>([trimmed]);

  const enMatch = trimmed.match(/-en(\d+)$/);
  if (enMatch) {
    out.add(enMatch[1]);
    out.add(`en${enMatch[1]}`);
    const unpadded = enMatch[1].replace(/^0+/, "") || enMatch[1];
    if (unpadded !== enMatch[1]) out.add(unpadded);
  }

  const trailingDigits = trimmed.match(/(\d+)$/);
  if (trailingDigits) {
    out.add(trailingDigits[1]);
    const unpadded = trailingDigits[1].replace(/^0+/, "") || trailingDigits[1];
    if (unpadded !== trailingDigits[1]) out.add(unpadded);
  }

  return [...out];
}

export function yugiohCollectorNumbersMatch(
  input: string | null | undefined,
  blueprintCollector: string | null | undefined
): boolean {
  if (!input?.trim() || !blueprintCollector?.trim()) return false;
  const left = yugiohCardNumberVariants(input);
  const right = yugiohCardNumberVariants(blueprintCollector);
  return left.some((value) => right.includes(value));
}

export function isYugiohLostArtCode(setCode: string | null | undefined): boolean {
  return yugiohSetPrefix(setCode) === "LART";
}

/** CardTrader groups LART prints under "Lost Art Promos", not year-specific promo names. */
export function isCardTraderLostArtPromosExpansion(expansionName: string): boolean {
  const name = expansionName.toLowerCase();
  return name.includes("lost art promo") && !/\b20\d{2}\b/.test(name);
}

export function yugiohSetCodeLooksLike(setCode: string | null | undefined): boolean {
  if (!setCode?.trim()) return false;
  return /^[A-Z0-9]+-(?:[A-Z]{2})?\d+$/i.test(setCode.trim());
}
