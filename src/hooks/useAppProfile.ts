"use client";

import { useDemoStore } from "@/lib/demo/store";

/** Profile for the local-only DeckVault app shell. */
export function useAppProfile() {
  const profile = useDemoStore((s) => s.profile);

  return {
    profile,
    isSupabaseMode: false,
  };
}
