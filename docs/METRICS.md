# DeckVault — Audit metrics

**Captured:** 2026-07-20  
**Environment:** Next.js dev server `http://localhost:3000`, Edge headless (`msedge.exe`), Windows.

Artifacts: [`docs/audit-artifacts/`](./audit-artifacts/).

## Lighthouse (dev, unauthenticated)

| Page | Performance | Accessibility | Best Practices | FCP | LCP |
|------|-------------:|--------------:|---------------:|----:|----:|
| `/collection` | 58 | 90 | 100 | 1.9 s | 2.1 s |
| `/login` | 70 | 90 | 100 | 1.0 s | 1.1 s |

Notes:

- Scores are from **dev** mode (not production build). Treat as directional, not launch gates.
- Lighthouse exited with cleanup `EPERM` on temp dirs under the sandbox; reports still wrote successfully.
- HTML/JSON: `lighthouse-collection.report.*`, `lighthouse-login.report.*`.

## Viewport screenshots

| File | Width |
|------|------:|
| `shot-collection-375.png` | 375 |
| `shot-collection-768.png` | 768 |
| `shot-collection-1440.png` | 1440 |
| `shot-collection-2560.png` | 2560 |

`/collection` redirected to the **login** screen (no session in headless). Captures still document the signed-out first viewport across breakpoints.

## knip

Command: `npx knip` (exit 1 = findings present).

| Category | Count |
|----------|------:|
| Unused files | 2 |
| Unused devDependencies | 4 |
| Unlisted dependencies | 1 |
| Unused exports | 86 |
| Unused exported types | 13 |

Highlights:

- Unused files: `scripts/verify-backup-import-runner.ts`, `src/components/ui/skeleton.tsx`
- Unused devDeps: `@tauri-apps/api`, `eslint`, `eslint-config-next`, `tsx` (likely false positives / config path)
- Unlisted: `postcss-load-config` (from `postcss.config.mjs`)
- Many unused exports are shadcn re-exports and CardTrader helpers kept for API surface

Raw dump: [`audit-artifacts/knip-raw.txt`](./audit-artifacts/knip-raw.txt).

## Source files &gt; 300 lines

| Lines | File |
|------:|------|
| 806 | `src/features/catalog/components/YugiohAdvancedSearchPanel.tsx` |
| 762 | `src/features/collection/components/QuickAddModal.tsx` |
| 753 | `src/lib/demo/store.ts` |
| 585 | `src/lib/data/server/supabase-service.ts` |
| 585 | `src/features/proxy-print/components/ProxyPrintPanel.tsx` |
| 556 | `src/lib/i18n/messages.ts` |
| 477 | `src/lib/i18n/messages-extra.ts` |
| 444 | `src/features/anime-collection/components/CharacterCardsView.tsx` |
| 439 | `src/features/proxy-print/components/ProxyBinderPreview.tsx` |
| 436 | `src/features/collection/components/CollectionBinderView.tsx` |
| 434 | `src/features/import/components/ImportModal.tsx` |
| 353 | `src/app/(dashboard)/settings/page.tsx` |
| 344 | `src/lib/proxy-print/parse-deck.ts` |
| 332 | `src/features/collection/components/CollectionManager.tsx` |
| 323 | `src/lib/proxy-print/resolve-slots.ts` |
| 321 | `src/features/import/services/external-wishlist-converter.ts` |
| 314 | `src/components/shared/CardInspectDialog.tsx` |
| 309 | `src/features/import/services/decklist-parser.ts` |

Guideline remains: prefer &lt; 300 lines when splitting is low-risk.

## Product scope check (this package)

| Item | Status |
|------|--------|
| Share / invites / Live collab removed from app code | Done |
| Local-mode banner + backup CTA | Done (`LocalModeBanner`) |
| In-memory IP rate limit on catalog APIs | Done (30/min) |
| Migrations `0010` + `0011` on Supabase | **Apply manually** if cloud DB still has old tables |
