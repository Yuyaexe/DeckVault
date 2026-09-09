import { z } from "zod";

/** Caps for expensive catalog / resolve routes (DoS + upstream cost). */
export const RESOLVE_DECK_MAX_ENTRIES = 100;
export const RESOLVE_BATCH_MAX_CARDS = 50;
export const PROXY_PRINT_MAX_CHARS = 80_000;
export const UPSTREAM_TIMEOUT_MS = 25_000;

export const resolveDeckBodySchema = z.object({
  gameSlug: z.string().min(1).max(32).optional(),
  entries: z
    .array(
      z
        .object({
          name: z.string().min(1).max(200),
          quantity: z.number().int().positive().max(999),
          setCode: z.string().max(64).nullable().optional(),
          passcode: z.union([z.number().int(), z.string().max(32), z.null()]).optional(),
          section: z.enum(["main", "extra", "side"]).nullable().optional(),
        })
        .passthrough()
    )
    .max(RESOLVE_DECK_MAX_ENTRIES)
    .default([]),
});

export const resolveBatchBodySchema = z.object({
  cards: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        name: z.string().min(1).max(200),
        setName: z.string().max(200).optional().nullable(),
        setCode: z.string().max(64).optional().nullable(),
        collectorNumber: z.string().max(64).optional().nullable(),
        rarity: z.string().max(64).optional().nullable(),
        externalId: z.string().max(128).optional().nullable(),
      }).passthrough()
    )
    .max(RESOLVE_BATCH_MAX_CARDS)
    .default([]),
});

export function upstreamSignal(ms = UPSTREAM_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}
