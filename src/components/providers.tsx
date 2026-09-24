"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { LocaleSync } from "@/lib/i18n/context";
import { useLocaleStore } from "@/lib/i18n/store";
import { useDataUiStore } from "@/lib/data/ui-store";
import { useDemoStore } from "@/lib/demo/store";
import { takeLegacyLocalStorageValue } from "@/lib/storage/indexeddb-storage";
import { QUERY_GC_MS, QUERY_STALE_MS } from "@/lib/cache/constants";

function PersistentStateGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finishIfReady = () => {
      if (cancelled) return;
      if (
        !useDemoStore.persist.hasHydrated() ||
        !useDataUiStore.persist.hasHydrated() ||
        !useLocaleStore.persist.hasHydrated()
      ) {
        return;
      }

      const legacyTheme = takeLegacyLocalStorageValue("theme");
      if (legacyTheme === "dark" || legacyTheme === "light") {
        useDataUiStore.getState().setTheme(legacyTheme);
      }

      setReady(true);
    };

    const unsubscribers = [
      useDemoStore.persist.onFinishHydration(finishIfReady),
      useDataUiStore.persist.onFinishHydration(finishIfReady),
      useLocaleStore.persist.onFinishHydration(finishIfReady),
    ];

    finishIfReady();

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando DeckVault...
      </div>
    );
  }

  return <>{children}</>;
}

function ThemeSync() {
  const theme = useDataUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [theme]);

  return null;
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = useDataUiStore((s) => s.theme);

  return (
    <TooltipProvider delayDuration={200}>
      <ThemeSync />
      <LocaleSync />
      {children}
      <Toaster theme={theme} position="bottom-right" richColors />
    </TooltipProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_STALE_MS,
            gcTime: QUERY_GC_MS,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PersistentStateGate>
        <AppProviders>{children}</AppProviders>
      </PersistentStateGate>
    </QueryClientProvider>
  );
}
