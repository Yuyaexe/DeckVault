"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useCollectionYugiohImageRepair } from "@/hooks/useCollectionYugiohImageRepair";
import { readPasscodeEntries, writePasscodeEntries } from "@/lib/cache/idb";
import { resolveYugiohPasscode } from "@/lib/yugioh/passcode";
import { yugiohPasscodeCacheKey } from "@/lib/yugioh/passcode-key";
import type { DemoCard, DemoOwnedCard } from "@/lib/demo/types";

type PasscodeMap = Map<string, string | null>;

const YugiohPasscodeContext = createContext<{
  map: PasscodeMap;
  isReady: boolean;
} | null>(null);

type CardPasscodeFields = Pick<
  DemoCard,
  "name" | "gameSlug" | "externalId" | "imageUrl" | "setCode" | "collectorNumber"
>;

function storedPasscodeForCard(card: CardPasscodeFields): string | null {
  if (card.gameSlug !== "yugioh") return null;
  return resolveYugiohPasscode(card.externalId, card.imageUrl, null);
}

async function fetchPasscodeBatch(
  cards: DemoOwnedCard[]
): Promise<Record<string, string | null>> {
  const yugiohCards = cards.filter((c) => c.card.gameSlug === "yugioh" && c.card.name.trim());
  if (yugiohCards.length === 0) return {};

  const res = await fetch("/api/cards/yugioh/resolve-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cards: yugiohCards.map((c) => ({
        id: c.id,
        name: c.card.name,
        setCode: c.card.setCode,
        collectorNumber: c.card.collectorNumber,
      })),
    }),
  });

  if (!res.ok) return {};
  const json = (await res.json()) as { passcodes?: Record<string, string | null> };
  return json.passcodes ?? {};
}

function buildSeedPasscodes(cards: DemoOwnedCard[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const owned of cards) {
    if (owned.card.gameSlug !== "yugioh") continue;
    const stored = storedPasscodeForCard(owned.card);
    if (stored) out[owned.id] = stored;
  }
  return out;
}

function cardsNeedingFetch(
  cards: DemoOwnedCard[],
  known: Record<string, string | null>
): DemoOwnedCard[] {
  return cards.filter((owned) => {
    if (owned.card.gameSlug !== "yugioh" || !owned.card.name.trim()) return false;
    if (owned.id in known) return false;
    return !storedPasscodeForCard(owned.card);
  });
}

export function YugiohPasscodeProvider({
  cards,
  children,
}: {
  cards: DemoOwnedCard[];
  children: ReactNode;
}) {
  const yugiohCards = useMemo(
    () => cards.filter((c) => c.card.gameSlug === "yugioh" && c.card.name.trim()),
    [cards]
  );

  const yugiohIds = useMemo(
    () => yugiohCards.map((c) => c.id).sort().join(","),
    [yugiohCards]
  );

  const [seedPasscodes, setSeedPasscodes] = useState<Record<string, string | null>>(() =>
    buildSeedPasscodes(cards)
  );
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const keys = [...new Set(yugiohCards.map((c) => yugiohPasscodeCacheKey(c.card)))];
      const cached = await readPasscodeEntries(keys);
      if (cancelled) return;

      const hydrated = buildSeedPasscodes(cards);
      const idbWrites: Array<{ key: string; passcode: string | null }> = [];

      for (const owned of yugiohCards) {
        const cacheKey = yugiohPasscodeCacheKey(owned.card);
        const entry = cached.get(cacheKey);
        if (entry !== undefined) {
          hydrated[owned.id] = entry.passcode;
          continue;
        }
        const stored = storedPasscodeForCard(owned.card);
        if (stored) {
          hydrated[owned.id] = stored;
          idbWrites.push({ key: cacheKey, passcode: stored });
        }
      }

      if (idbWrites.length) void writePasscodeEntries(idbWrites);
      setSeedPasscodes(hydrated);
      setCacheReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [yugiohIds, cards, yugiohCards]);

  const uncachedCards = useMemo(
    () => (cacheReady ? cardsNeedingFetch(yugiohCards, seedPasscodes) : []),
    [cacheReady, yugiohCards, seedPasscodes]
  );

  const uncachedKey = useMemo(
    () => uncachedCards.map((c) => c.id).sort().join(","),
    [uncachedCards]
  );

  const { data: fetchedPasscodes, isFetched } = useQuery({
    queryKey: ["ygo-passcode-batch", yugiohIds, uncachedKey],
    queryFn: async () => {
      const remote = await fetchPasscodeBatch(uncachedCards);
      const idbWrites: Array<{ key: string; passcode: string | null }> = [];
      for (const owned of uncachedCards) {
        const passcode = remote[owned.id] ?? null;
        idbWrites.push({ key: yugiohPasscodeCacheKey(owned.card), passcode });
      }
      if (idbWrites.length) void writePasscodeEntries(idbWrites);
      return remote;
    },
    enabled: cacheReady && uncachedCards.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  });

  const mergedPasscodes = useMemo(() => {
    const merged = { ...seedPasscodes, ...fetchedPasscodes };
    for (const owned of yugiohCards) {
      if (!(owned.id in merged)) merged[owned.id] = null;
    }
    return merged;
  }, [seedPasscodes, fetchedPasscodes, yugiohCards]);

  const map = useMemo(
    () => new Map<string, string | null>(Object.entries(mergedPasscodes)),
    [mergedPasscodes]
  );

  const isReady =
    yugiohCards.length === 0 ||
    (cacheReady && (uncachedCards.length === 0 || isFetched));

  const value = useMemo(() => ({ map, isReady }), [map, isReady]);

  return (
    <YugiohPasscodeContext.Provider value={value}>
      {children}
    </YugiohPasscodeContext.Provider>
  );
}

export function useYugiohPasscodeContext() {
  return useContext(YugiohPasscodeContext);
}

export function YugiohPasscodeSync({
  cards,
  children,
}: {
  cards: DemoOwnedCard[];
  children: ReactNode;
}) {
  const ctx = useYugiohPasscodeContext();
  useCollectionYugiohImageRepair(cards, ctx?.map, ctx?.isReady ?? false);
  return <>{children}</>;
}

export function resolvePasscodeFromContext(
  ownedCardId: string | undefined,
  context: { map: PasscodeMap; isReady: boolean } | null,
  card?: CardPasscodeFields
): string | null | undefined {
  if (card?.gameSlug === "yugioh") {
    const stored = storedPasscodeForCard(card);
    if (stored) return stored;
  }

  if (!context) return undefined;
  if (ownedCardId && context.map.has(ownedCardId)) {
    return context.map.get(ownedCardId) ?? null;
  }
  if (!context.isReady) return undefined;
  if (!ownedCardId) return null;
  return context.map.get(ownedCardId) ?? null;
}
