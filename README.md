# DeckVault

**Guia simples:** [docs/guia-do-usuario/COMECE-AQUI.md](docs/guia-do-usuario/COMECE-AQUI.md)

**Documentação e contexto do projeto:** [docs/INDEX.md](docs/INDEX.md)

Manage your **Yu-Gi-Oh!**, **Pokémon**, and **Digimon** cards in one place — collection, imports/exports, anime side collection, proxy print, and local backups.

## Get started (2 minutes)

**Programa instalado:** use o instalador mais recente em `releases/<versão>/`.

**Navegador local:** double-click `DeckVault.bat`

**Or from the terminal:**

```bash
npm install
npm run dev
```

Open [http://localhost:3000/collection](http://localhost:3000/collection)

No account needed. Your data is stored locally in IndexedDB. Older DeckVault data in localStorage is migrated automatically on first launch.

For local development, `CARDTRADER_API_TOKEN` can be set in the server environment. The installed Windows app stores the token from Settings outside the repository. A production web server must explicitly set `DECKVAULT_ALLOW_CARDTRADER_PURCHASES=1` before exposing purchase history.

## What you can do

- **Collection views** — grid, binder (drag to reorder; drop on *Anterior* / *Próxima* to move across pages), table, compact
- **Search & add** — Yu-Gi-Oh! cards from **YGOPRODeck** (names, images, sets, passcodes)
- **Import** — decklists (text with `Monster` / `Spell` / `Trap` sections, YDKE, YDK), DigimonCard.io format, CSV
- **Export** — TXT decklist, CSV, `.ydk` (EdoPro)
- **Collections** — multiple local collections, favorites, ordering and binder layouts
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

## Backup details

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
and `latest.yml` to a GitHub Release with the same version tag. Also upload the
matching `.blockmap` file and mark the release as latest; without `latest.yml`,
the updater cannot find an update.

### Dev scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # ESLint
```

## Out of scope

Cloud accounts, Supabase sync, collection sharing/collaboration, realtime presence, community features, price graphs, trading and notifications are not part of the current local-only product.
