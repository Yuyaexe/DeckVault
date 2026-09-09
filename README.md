# DeckVault

Manage your **Yu-Gi-Oh!**, **Pokémon**, and **Digimon** cards in one place — collection, imports/exports, anime side collection, proxy print, and optional cloud sync.

## Get started (2 minutes)

**Windows:** double-click `DeckVault.bat`

**Or from the terminal:**

```bash
npm install
npm run dev
```

Open [http://localhost:3000/collection](http://localhost:3000/collection)

No account needed. Your data stays in the browser until you set up cloud sync.

## What you can do

- **Collection views** — grid, binder (drag to reorder; drop on *Anterior* / *Próxima* to move across pages), table, compact
- **Search & add** — Yu-Gi-Oh! cards from **YGOPRODeck** (names, images, sets, passcodes)
- **Import** — decklists (text with `Monster` / `Spell` / `Trap` sections, YDKE, YDK), DigimonCard.io format, CSV
- **Export** — TXT decklist, CSV, `.ydk` (EdoPro)
- **Collections** — multiple collections (cloud optional); **share** with editors/viewers by email invite
- **Activity** — log of who changed which cards, with undo for simple edits
- **Mercado** — external links per card (Yu-Gi-Oh!: TCGPlayer, Liga Yu-Gi-Oh!, MyP Cards, CardTrader)
- **Anime collection** — optional side collection for character/series cards
- **Proxy print** — print proxy sheets
- **Backup** — download/restore a JSON file from Settings (always available; do not skip this). In local mode a banner reminds you to download.

**Card data sources**

| Game | Catalog & images | Marketplace |
|------|------------------|-------------|
| Yu-Gi-Oh! | [YGOPRODeck](https://ygoprodeck.com/) | TCGPlayer, Liga, MyP, CardTrader (links only) |
| Pokémon | Pokémon TCG API | TCGPlayer, Cardmarket, CardTrader |
| Digimon | DigimonCard.io API | TCGPlayer, Cardmarket, CardTrader |

CardTrader is **not** used for search or live prices — only product/search URLs in the Mercado section.

**Save your data:** Settings → Backup → download JSON. Restore anytime from the same screen.

---

## Advanced setup

Everything below is optional — only needed for cloud sync or building a desktop app.

### Demo vs Supabase

| Mode | When to use |
|------|-------------|
| **Demo / Local** | Try locally, no setup. Data in browser (localStorage). |
| **Supabase** | Login + cloud backup of your own collections. |

### Supabase + Vercel

1. Create a project at [supabase.com](https://supabase.com)
2. Copy env vars into `.env.local` (Supabase URL, anon key, `DATABASE_URL`)
3. Run migrations in the SQL Editor — files `0001` through `0014` in `src/lib/db/migrations/`, in order
4. Deploy to [Vercel](https://vercel.com)
5. Supabase → **Authentication → URL Configuration** — set Site URL to your Vercel domain

### Migrations

Run in SQL Editor, in order:

1. `0001_seed_and_indexes.sql`
2. `0002_rls_policies.sql`
3. `0003_collaboration.sql` (legacy; tables dropped in `0011`)
4. `0004_create_collection_rpc.sql`
5. `0005_rls_phase3_tables.sql` (legacy; tables dropped in `0010`)
6. `0006_security_hardening.sql`
7. `0007_rls_missing_policies.sql`
8. `0008_private_rls_helpers.sql`
9. `0009_cards_catalog_immutable.sql` (if present)
10. `0010_drop_unused_phase_tables.sql`
11. `0011_drop_collaboration.sql`
12. `0012_collaboration_and_activity.sql` (reintroduces members/invites + activity log)
13. `0013_anime_workspace_share.sql` (shareable Anime Collection workspace)
14. `0014_anime_invite_email_fallback.sql` (anime invite accept email fallback)

**Auth tip:** enable **Leaked password protection** under Authentication → Providers → Email.

### Backup details

- **Download** — profile, collections, and cards as DeckVault JSON
- **Restore** — merges into existing collections (same collection name = same collection)
- CT app exports (`yugioh-backup-*.json`, `yugioh-collection-*.json`) import via Settings → Restore

### Desktop app (.exe)

DeckVault can run as a standalone Windows desktop application, similar to VS Code.
The desktop shell embeds the Next.js server and does not open a browser window.
Node.js is only needed on the development machine; the generated installer includes
the runtime.

```powershell
npm install
npm run desktop:dev       # open the desktop app locally
npm run desktop:build     # generate the Windows installer
```

The installer is generated in `release/`. The previous Tauri commands
(`npm run tauri:dev` and `npm run tauri:build`) remain available for contributors
who have Rust installed.

#### Automatic updates

Installed desktop builds check GitHub Releases for a newer version when they
start. The update is downloaded in the background and the user can restart
the app to install it. To publish an update, increment `version` in
`package.json`, run `npm run desktop:build`, and upload the generated installer
and `latest.yml` to a GitHub Release with the same version tag.

### Dev scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # ESLint
```

## Out of scope

Deck builder, wishlist, price graphs, trading, notifications, community features, and **Live realtime presence** are **not** part of the current product. Share/collab and Activity log **are** supported in cloud mode.
