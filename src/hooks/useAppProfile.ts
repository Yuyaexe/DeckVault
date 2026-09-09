"use client";

import { useQuery } from "@tanstack/react-query";
import { useDemoStore } from "@/lib/demo/store";
import type { DemoProfile } from "@/lib/demo/types";

type AppMode = "supabase" | "demo";

async function fetchConfig(): Promise<{ mode: AppMode }> {
  const res = await fetch("/api/app/config");
  if (!res.ok) return { mode: "demo" };
  return res.json();
}

async function fetchAppState(): Promise<{ profile: DemoProfile }> {
  const res = await fetch("/api/app/state");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

/** Profile + mode for layout chrome — select avoids re-renders when ownedCards change. */
export function useAppProfile() {
  const demoProfile = useDemoStore((s) => s.profile);

  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: fetchConfig,
    staleTime: 30_000,
  });

  const isSupabaseMode = config?.mode === "supabase";

  const { data: profile } = useQuery({
    queryKey: ["app-state"],
    queryFn: fetchAppState,
    enabled: isSupabaseMode,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (state) => state.profile,
  });

  return {
    profile: isSupabaseMode ? (profile ?? demoProfile) : demoProfile,
    isSupabaseMode,
  };
}
