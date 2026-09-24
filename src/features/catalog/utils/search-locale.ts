import type { CatalogSearchLocale } from "@/features/catalog/services/card-api/types";
import type { Currency } from "@/types/tcg";
import { readStoredString, writeStoredString } from "@/lib/storage/indexeddb-storage";

const STORAGE_KEY = "deckvault-search-locale";

export async function readSearchLocale(
  currency: Currency = "USD"
): Promise<CatalogSearchLocale> {
  const stored = await readStoredString(STORAGE_KEY);
  if (stored === "pt" || stored === "en") return stored;
  return currency === "BRL" ? "pt" : "en";
}

export async function writeSearchLocale(locale: CatalogSearchLocale): Promise<void> {
  await writeStoredString(STORAGE_KEY, locale);
}

export const SEARCH_LOCALE_OPTIONS: { value: CatalogSearchLocale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt", label: "PT-BR" },
];
