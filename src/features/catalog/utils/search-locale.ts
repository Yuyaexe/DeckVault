import type { CatalogSearchLocale } from "@/features/catalog/services/card-api/types";
import type { Currency } from "@/types/tcg";

const STORAGE_KEY = "deckvault-search-locale";

export function readSearchLocale(currency: Currency = "USD"): CatalogSearchLocale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "pt" || stored === "en") return stored;
  return currency === "BRL" ? "pt" : "en";
}

export function writeSearchLocale(locale: CatalogSearchLocale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}

export const SEARCH_LOCALE_OPTIONS: { value: CatalogSearchLocale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt", label: "PT-BR" },
];
