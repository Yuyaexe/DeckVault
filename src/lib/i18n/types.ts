export type AppLocale = "en" | "pt-BR";

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_OPTIONS: { value: AppLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "pt-BR", label: "Português (Brasil)" },
];
