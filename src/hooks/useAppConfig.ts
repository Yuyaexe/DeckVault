"use client";

export function useAppConfig() {
  return {
    mode: "demo" as const,
    isSupabaseMode: false,
    configLoading: false,
  };
}
