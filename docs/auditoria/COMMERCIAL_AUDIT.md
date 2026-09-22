# DeckVault — Commercial Audit

**Date:** 2026-07-20 (updated: Share removed + local banner + rate limit + metrics)  
**Code evidence score (pre-slim):** **6.2 / 10**

## Product decisions (current)

| Keep | Cut |
|------|-----|
| Collection + `/collections` | Wishlist, decks, prices, trades, notifs |
| JSON **file** backup/restore | Tags, in-collection folders |
| Anime, proxy-print, multi-TCG | Phase 4 community |
| Cloud sync (own account) | Magic/OP/Lorcana seeds |
| | **Live** + **Share / invites** |

## Shipped in this audit cycle

1. Slim schema + migrations `0010` / `0011` (drop dead Phase tables + collaboration)
2. Live removed; Share/invite UI + API removed
3. Group C cleanup (orphan modal, dead exports, binder chrome)
4. Perf Top 3: image optimize, lazy Advanced Search, API caps/Zod, leaner app-state
5. Local-mode banner + backup CTA
6. In-memory IP rate limit on expensive catalog routes (30/min)

## Metrics (this session)

See [METRICS.md](./METRICS.md) — knip, Lighthouse (dev), screenshots, files &gt;300 lines.

## Remaining

- Full binder virtualization
- Split remaining god files
- Playwright / Vitest product tests
- Durable rate limiting (Redis / edge) for multi-instance production
