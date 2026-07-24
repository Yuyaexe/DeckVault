"use client";

import { create } from "zustand";

export type AnimeShareSyncStatus =
  | "idle"
  | "syncing"
  | "shared"
  | "owner"
  | "empty"
  | "error";

interface AnimeShareSyncState {
  status: AnimeShareSyncStatus;
  error: string | null;
  isOwner: boolean | null;
  role: string | null;
  /** null = unknown / local mode; false = cloud but not shared; true = collaborating */
  isShared: boolean | null;
  lastSyncedAt: number | null;
  /** 0–100 while a visible sync is running; null when idle. */
  progress: number | null;
  setStatus: (
    status: AnimeShareSyncStatus,
    patch?: Partial<
      Pick<
        AnimeShareSyncState,
        "error" | "isOwner" | "role" | "isShared" | "lastSyncedAt" | "progress"
      >
    >
  ) => void;
  setProgress: (progress: number | null) => void;
  requestSync: number;
  /** Incremented to force an immediate push (confirmed deletes) without pull-first. */
  requestPriorityPush: number;
  triggerSync: () => void;
  /** Push local tombstones/deletes ASAP — prefer over triggerSync after confirmed deletes. */
  triggerPriorityPush: () => void;
}

export const useAnimeShareSyncStore = create<AnimeShareSyncState>((set) => ({
  status: "idle",
  error: null,
  isOwner: null,
  role: null,
  isShared: null,
  lastSyncedAt: null,
  progress: null,
  requestSync: 0,
  requestPriorityPush: 0,
  setStatus: (status, patch) => set({ status, ...patch }),
  setProgress: (progress) => set({ progress }),
  triggerSync: () => set((s) => ({ requestSync: s.requestSync + 1 })),
  triggerPriorityPush: () => set((s) => ({ requestPriorityPush: s.requestPriorityPush + 1 })),
}));
