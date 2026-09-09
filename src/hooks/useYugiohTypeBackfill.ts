"use client";

import { useEffect, useRef } from "react";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import type { DemoCard } from "@/lib/demo/types";

/** Keys we already successfully typed (or permanently failed after a real attempt). */
const resolvedKeysGlobal = new Set<string>();
const inFlightKeysGlobal = new Set<string>();

type TypeCardFields = Pick<DemoCard, "gameSlug" | "externalId" | "type" | "name">;

export type YugiohTypeRepair = { id: string; updates: { type: string } };

/**
 * Backfill missing `card.type` for Yu-Gi-Oh entries (passcode and/or name).
 */
export function useYugiohTypeBackfill(
  items: Array<{ id: string; card: TypeCardFields }>,
  passcodes: Map<string, string | null> | undefined,
  isReady: boolean,
  applyRepairs: (repairs: YugiohTypeRepair[]) => void
): void {
  const applyRepairsRef = useRef(applyRepairs);
  applyRepairsRef.current = applyRepairs;

  useEffect(() => {
    const needsFetch: Array<{ id: string; passcode: string | null; name: string }> = [];

    for (const item of items) {
      if (item.card.gameSlug !== "yugioh") continue;
      if (item.card.type?.trim()) {
        resolvedKeysGlobal.add(item.id);
        continue;
      }
      if (resolvedKeysGlobal.has(item.id) || inFlightKeysGlobal.has(item.id)) continue;

      const fromMap = passcodes?.get(item.id) ?? null;
      const fromExternal = isYugiohPasscodeId(item.card.externalId, null)
        ? item.card.externalId
        : null;
      const passcode = fromMap || fromExternal;

      // Wait for passcode resolution when we have neither passcode nor a usable name yet.
      if (!passcode && !isReady && !item.card.name.trim()) continue;

      needsFetch.push({
        id: item.id,
        passcode,
        name: item.card.name.trim(),
      });
    }

    if (needsFetch.length === 0) return;

    for (const row of needsFetch) inFlightKeysGlobal.add(row.id);

    let cancelled = false;

    void (async () => {
      const payload = {
        cards: needsFetch.map((row) => ({
          key: row.id,
          id: row.passcode ?? undefined,
          name: row.name || undefined,
        })),
      };

      let types: Record<string, string> = {};
      try {
        const res = await fetch("/api/cards/yugioh/types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = (await res.json()) as { types?: Record<string, string> };
          types = json.types ?? {};
        }
      } catch {
        // ignore
      }

      if (cancelled) {
        for (const row of needsFetch) inFlightKeysGlobal.delete(row.id);
        return;
      }

      const repairs: YugiohTypeRepair[] = [];
      for (const row of needsFetch) {
        inFlightKeysGlobal.delete(row.id);
        const type =
          types[row.id] ??
          (row.passcode
            ? types[row.passcode] ??
              types[String(parseInt(row.passcode, 10))] ??
              types[row.passcode.padStart(8, "0")]
            : undefined) ??
          (row.name ? types[`name:${row.name.toLowerCase()}`] : undefined);

        if (type) {
          resolvedKeysGlobal.add(row.id);
          repairs.push({ id: row.id, updates: { type } });
        }
        // If unresolved, allow a later retry when passcodes become ready.
      }

      if (repairs.length > 0) applyRepairsRef.current(repairs);
    })();

    return () => {
      cancelled = true;
      for (const row of needsFetch) inFlightKeysGlobal.delete(row.id);
    };
  }, [items, passcodes, isReady]);
}
