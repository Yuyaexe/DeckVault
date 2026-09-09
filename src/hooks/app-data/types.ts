import type { DemoCollection, DemoOwnedCard, DemoProfile, DemoTag } from "@/lib/demo/types";

export type AppMode = "supabase" | "demo";

export interface AppState {
  profile: DemoProfile;
  collections: DemoCollection[];
  ownedCards: DemoOwnedCard[];
  tags: DemoTag[];
}

export async function fetchAppConfig(): Promise<{ mode: AppMode }> {
  const res = await fetch("/api/app/config");
  if (!res.ok) return { mode: "demo" };
  return res.json();
}

export async function fetchAppState(): Promise<AppState> {
  const res = await fetch("/api/app/state");
  if (!res.ok) throw new Error("Failed to load state");
  return res.json();
}
