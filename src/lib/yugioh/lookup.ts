import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

/** Normalize card names for reliable equality checks. */
export function normalizeYugiohCardName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function yugiohCardNamesMatch(a: string, b: string): boolean {
  return normalizeYugiohCardName(a) === normalizeYugiohCardName(b);
}

export function yugiohSetNumberRef(
  setCode?: string | null,
  collectorNumber?: string | null
): string | null {
  const ref = (collectorNumber ?? setCode)?.trim().toUpperCase();
  if (!ref || !/^[A-Z0-9]+-EN\d+/i.test(ref)) return null;
  return ref;
}

export function passcodeFromYgoImageUrl(url: string | null | undefined): string | null {
  const match = url?.match(/\/cards(?:_small|_cropped)?\/(\d+)\.jpg/i);
  return match?.[1] ?? null;
}

interface ResolveResponse {
  result: CardSearchResult | null;
}

export async function fetchYugiohCardByName(name: string): Promise<CardSearchResult | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const res = await fetch(`/api/cards/yugioh/resolve?name=${encodeURIComponent(trimmed)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as ResolveResponse;
  return json.result ?? null;
}

export async function fetchYugiohCardBySetNumber(
  setNumber: string
): Promise<CardSearchResult | null> {
  const ref = setNumber.trim().toUpperCase();
  if (!ref) return null;

  const res = await fetch(`/api/cards/yugioh/resolve?set=${encodeURIComponent(ref)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as ResolveResponse;
  return json.result ?? null;
}

export interface YugiohOwnedCardDetailResponse {
  result: CardSearchResult | null;
  relatedPrints: CardSearchResult[];
  passcode?: string | null;
}

/** Single POST — resolves passcode, card detail, and alternate prints. */
export async function fetchYugiohOwnedCardDetail(card: {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  externalId?: string | null;
}): Promise<YugiohOwnedCardDetailResponse> {
  const res = await fetch("/api/cards/yugioh/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!res.ok) return { result: null, relatedPrints: [] };
  return (await res.json()) as YugiohOwnedCardDetailResponse;
}

/** Resolve Konami passcode for an owned Yu-Gi-Oh card (set number first, then exact name). */
export async function fetchYugiohPasscodeForCard(card: {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
}): Promise<string | null> {
  const setRef = yugiohSetNumberRef(card.setCode, card.collectorNumber);
  if (setRef) {
    const bySet = await fetchYugiohCardBySetNumber(setRef);
    if (bySet?.externalId) {
      if (!card.name.trim() || yugiohCardNamesMatch(bySet.name, card.name)) {
        return bySet.externalId;
      }
    }
  }

  const byName = await fetchYugiohCardByName(card.name);
  return byName?.externalId ?? null;
}
