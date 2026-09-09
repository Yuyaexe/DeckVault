"use client";

import { useCallback, useEffect } from "react";
import { translate, type MessageKey } from "@/lib/i18n/messages";
import { useLocaleStore } from "@/lib/i18n/store";
import type { AppLocale } from "@/lib/i18n/types";
import { writeSearchLocale } from "@/features/catalog/utils/search-locale";

export function useLocale(): AppLocale {
  return useLocaleStore((s) => s.locale);
}

export function useT() {
  const locale = useLocale();
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale]
  );
}

export function LocaleSync() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : "en";
    writeSearchLocale(locale === "pt-BR" ? "pt" : "en");
  }, [locale]);

  return null;
}
