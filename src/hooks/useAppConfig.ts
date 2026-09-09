"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAppConfig, type AppMode } from "@/hooks/app-data/types";

export function useAppConfig() {
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
    staleTime: 30_000,
  });

  const mode: AppMode = config?.mode ?? "demo";

  return {
    mode,
    isSupabaseMode: mode === "supabase",
    configLoading,
  };
}
