#!/usr/bin/env node
/**
 * Downloads bundled anime series covers + character portraits.
 * Source: Yu-Gi-Oh! Wiki (Fandom) pageimages API.
 *
 * Usage:
 *   node scripts/download-anime-assets.mjs
 *   node scripts/download-anime-assets.mjs --force paradox-brothers
 *   node scripts/download-anime-assets.mjs --only series
 *   node scripts/download-anime-assets.mjs --only gx arc-v dm
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

const USER_AGENT = "DeckVault/1.0 (local anime asset bundler; personal project)";
const BATCH_SIZE = 10;
const DELAY_MS = 1200;

const SERIES_COVERS = [
  { key: "yu-gi-oh", wiki: "Yu-Gi-Oh!" },
  { key: "yu-gi-oh-gx", wiki: "Yu-Gi-Oh! GX" },
  { key: "yu-gi-oh-5ds", wiki: "Yu-Gi-Oh! 5D's" },
  { key: "yu-gi-oh-zexal", wiki: "Yu-Gi-Oh! ZEXAL" },
  { key: "yu-gi-oh-arc-v", wiki: "Yu-Gi-Oh! ARC-V" },
  { key: "yu-gi-oh-vrains", wiki: "Yu-Gi-Oh! VRAINS" },
];

const PORTRAIT_GROUPS = {
  dm: {
    dir: join(PUBLIC, "anime-characters", "yu-gi-oh"),
    entries: [
      { slug: "yami-yugi", wiki: "Yami_Yugi" },
      { slug: "yugi-muto", wiki: "Yugi_Muto" },
      { slug: "seto-kaiba", wiki: "Seto_Kaiba" },
      { slug: "joey-wheeler", wiki: "Joey_Wheeler" },
      { slug: "tea-gardner", wiki: "Téa_Gardner" },
      { slug: "mai-valentine", wiki: "Mai_Valentine" },
      { slug: "pegasus", wiki: "Maximillion_Pegasus" },
      { slug: "bakura", wiki: "Yami_Bakura" },
      { slug: "marik-ishtar", wiki: "Marik_Ishtar" },
      { slug: "weevil-underwood", wiki: "Weevil_Underwood" },
      { slug: "rex-raptor", wiki: "Rex_Raptor" },
      { slug: "bandit-keith", wiki: "Bandit_Keith" },
      { slug: "mako-tsunami", wiki: "Mako_Tsunami" },
      { slug: "espa-roba", wiki: "Espa_Roba" },
      { slug: "duke-devlin", wiki: "Duke_Devlin" },
      { slug: "rebecca", wiki: "Rebecca_Hawkins" },
      { slug: "mokuba-kaiba", wiki: "Mokuba_Kaiba" },
      { slug: "solomon-muto", wiki: "Solomon_Muto" },
      { slug: "paradox-brothers", wiki: "Paradox_Brothers" },
      { slug: "ishizu-ishtar", wiki: "Ishizu_Ishtar" },
      { slug: "odion", wiki: "Odion" },
      { slug: "rafael", wiki: "Rafael" },
      { slug: "arkana", wiki: "Arkana" },
      { slug: "bonz", wiki: "Bonz" },
      { slug: "lumis-umbra", wiki: "Lumis_and_Umbra" },
      { slug: "noah-kaiba", wiki: "Noah_Kaiba" },
      { slug: "dartz", wiki: "Dartz" },
      { slug: "aigami", wiki: "Aigami" },
    ],
  },
  gx: {
    dir: join(PUBLIC, "anime-characters", "yu-gi-oh-gx"),
    entries: [
      { slug: "jaden", wiki: "Jaden_Yuki" },
      { slug: "alexis", wiki: "Alexis_Rhodes" },
      { slug: "syrus", wiki: "Syrus_Truesdale" },
      { slug: "zane", wiki: "Zane_Truesdale" },
      { slug: "chazz", wiki: "Chazz_Princeton" },
      { slug: "camula", wiki: "Camula" },
      { slug: "lorenzo", wiki: "Lorenzo" },
      { slug: "sartorius", wiki: "Sartorius" },
      { slug: "aster-phoenix", wiki: "Aster_Phoenix" },
      { slug: "yubel", wiki: "Yubel" },
      { slug: "viper", wiki: "Thelonious_Viper" },
      { slug: "atticus", wiki: "Atticus_Rhodes" },
      { slug: "jim", wiki: "Jim_Crocodile_Cook" },
      { slug: "axel", wiki: "Axel_Brodie" },
      { slug: "jesse", wiki: "Jesse_Anderson" },
      { slug: "crowler", wiki: "Vellian_Crowler" },
      { slug: "bonaparte", wiki: "Jean-Louis_Bonaparte" },
      { slug: "shepard", wiki: "Chancellor_Sheppard" },
      { slug: "bastion", wiki: "Bastion_Misawa" },
      { slug: "tyranno-hassleberry", wiki: "Tyranno_Hassleberry" },
      { slug: "blair", wiki: "Blair_Flannigan" },
      { slug: "yusuke-fujiwara", wiki: "Yusuke_Fujiwara" },
      { slug: "professor-banner", wiki: "Lyman_Banner" },
      { slug: "chumley", wiki: "Chumley_Huffington" },
      { slug: "sarina", wiki: "Sarina" },
      { slug: "adrian-gecko", wiki: "Adrian_Gecko" },
      { slug: "kagemaru", wiki: "Kagemaru" },
      { slug: "marcel", wiki: "Marcel_Bonaparte" },
      { slug: "abidos-the-third", wiki: "Abidos_the_Third" },
      { slug: "belowski", wiki: "Belowski" },
    ],
  },
  "arc-v": {
    dir: join(PUBLIC, "anime-characters", "yu-gi-oh-arc-v"),
    entries: [
      { slug: "yuya", wiki: "Yuya_Sakaki" },
      { slug: "yuri", wiki: "Yuri" },
      { slug: "yuto", wiki: "Yuto" },
      { slug: "yugo", wiki: "Yugo" },
      { slug: "yuzu", wiki: "Zuzu_Boyle" },
      { slug: "serena", wiki: "Celina" },
      { slug: "ruri", wiki: "Ruri_Kurosaki_(DY)" },
      { slug: "rin", wiki: "Rin" },
      { slug: "reiji-akaba", wiki: "Reiji_Akaba_(DY)" },
      { slug: "gong-strong", wiki: "Gong_Strong" },
      { slug: "sora", wiki: "Sora Shiun'in", url: "https://static.wikia.nocookie.net/yugioh/images/3/35/Sora-TFSP.png/revision/latest?cb=20150622134646" },
      { slug: "frederick", wiki: "Frederick" },
      { slug: "allie", wiki: "Allie" },
      { slug: "sawatari", wiki: "Sylvio_Sawatari" },
      { slug: "shijima", wiki: "Dipper_O'rion" },
      { slug: "julia", wiki: "Julia_Krystal" },
      { slug: "kit", wiki: "Kit_Blade" },
      { slug: "shun", wiki: "Shay_Obsidian" },
      { slug: "isao", wiki: "Iggy_Arlo" },
      { slug: "mieru", wiki: "Aura_Sentia" },
      { slug: "chojiro-tokumatsu", wiki: "Chojiro_Tokumatsu" },
      { slug: "gloria-tyler", wiki: "Gloria_Tyler" },
      { slug: "grace-tyler", wiki: "Grace_Tyler" },
      { slug: "allen-kozuki", wiki: "Allen_Kozuki" },
      { slug: "dennis", wiki: "Dennis_McField" },
      { slug: "battle-beast", wiki: "Battle_Beast" },
    ],
  },
  "5ds": {
    dir: join(PUBLIC, "anime-characters", "yu-gi-oh-5ds"),
    entries: [
      { slug: "yusei", wiki: "Yusei_Fudo" },
      { slug: "crow", wiki: "Crow_Hogan" },
      { slug: "trudge", wiki: "Tetsu_Trudge" },
      { slug: "team-unicorn", wiki: "Team_Unicorn" },
      { slug: "team-catastrophe", wiki: "Team_Catastrophe" },
      { slug: "lazar", wiki: "Lazar" },
      { slug: "rex-godwin", wiki: "Rex_Goodwin" },
      { slug: "iliaster", wiki: "Iliaster" },
      { slug: "team-ragnarok", wiki: "Team_Ragnarok" },
      { slug: "leo", wiki: "Leo" },
      { slug: "luna", wiki: "Luna" },
      { slug: "akiza", wiki: "Akiza_Izinski" },
      { slug: "jack", wiki: "Jack_Atlas" },
      { slug: "team-taiyo", wiki: "Team_Taiyo" },
      { slug: "carly", wiki: "Carly_Carmine" },
      { slug: "kalin", wiki: "Kalin_Kessler" },
      { slug: "kazama", wiki: "Shunsuke_Kazama" },
      { slug: "bruno", wiki: "Bruno" },
      { slug: "yanagi", wiki: "Tenzen_Yanagi" },
      { slug: "hunter-pace", wiki: "Hunter_Pace" },
      { slug: "greiger", wiki: "Greiger" },
      { slug: "sherry", wiki: "Sherry_LeBlanc" },
      { slug: "lawton", wiki: "Lawton" },
      { slug: "misty", wiki: "Misty_Tredwell" },
      { slug: "roman", wiki: "Roman_Goodwin" },
      { slug: "devack", wiki: "Devack" },
      { slug: "armstrong", wiki: "Mr._Armstrong" },
      { slug: "paradox", wiki: "Paradox" },
      { slug: "lester", wiki: "Lester" },
      { slug: "aporia", wiki: "Aporia" },
      { slug: "zone", wiki: "Z-one" },
      { slug: "andre", wiki: "Andre" },
      { slug: "dragan", wiki: "Dragan" },
    ],
  },
  zexal: {
    dir: join(PUBLIC, "anime-characters", "yu-gi-oh-zexal"),
    entries: [
      { slug: "yuma", wiki: "Yuma_Tsukumo" },
      { slug: "kite", wiki: "Kite_Tenjo" },
      { slug: "shark", wiki: "Reginald_Kastle" },
      { slug: "bronk", wiki: "Bronk_Stone" },
      { slug: "rally-dawson", wiki: "Rally_Dawson" },
      { slug: "astral", wiki: "Astral" },
      { slug: "quattro", wiki: "Quattro" },
      { slug: "tron", wiki: "Vetrix" },
      { slug: "trey", wiki: "Trey" },
      { slug: "quinton", wiki: "Quinton" },
      { slug: "nelson", wiki: "Nelson_Andrews" },
      { slug: "alito", wiki: "Alito" },
      { slug: "anna-kaboom", wiki: "Anna_Kaboom" },
      { slug: "dr-faker", wiki: "Dr._Faker" },
      { slug: "vector", wiki: "Vector" },
      { slug: "tori", wiki: "Tori_Meadows" },
      { slug: "orbital-7", wiki: "Orbital_7" },
    ],
  },
  vrains: {
    dir: join(PUBLIC, "anime-characters", "yu-gi-oh-vrains"),
    entries: [
      { slug: "playmaker", wiki: "Yusaku_Fujiki" },
      { slug: "ai", wiki: "Ai" },
      { slug: "soulburner", wiki: "Theodore_Hamilton" },
      { slug: "go-onizuka", wiki: "George_Gore" },
      { slug: "blue-angel", wiki: "Skye_Zaizen" },
      { slug: "varis", wiki: "Varis" },
      { slug: "spectre", wiki: "Spectre" },
      { slug: "ghost-gal", wiki: "Emma_Bessho" },
      { slug: "akira-zaizen", wiki: "Akira_Zaizen" },
    ],
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toFullSizeUrl(thumbUrl) {
  return thumbUrl.replace(/\/scale-to-width-down\/\d+/, "");
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

async function queryThumbnails(entries) {
  const titles = entries.map((entry) => entry.wiki).join("|");
  const apiUrl =
    "https://yugioh.fandom.com/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      prop: "pageimages",
      pithumbsize: "512",
      titles,
    });

  const data = await fetchJson(apiUrl);
  const pages = data?.query?.pages ?? {};
  const byTitle = new Map();

  for (const page of Object.values(pages)) {
    if (page?.title) byTitle.set(page.title, page);
  }

  return byTitle;
}

function parseArgs(argv) {
  const forceSlugs = new Set();
  let only = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        forceSlugs.add(argv[++i]);
      }
    } else if (arg === "--only") {
      only = [];
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        only.push(argv[++i]);
      }
    }
  }

  return { forceSlugs, only };
}

async function downloadPortraitBatch(groupName, group, forceSlugs) {
  mkdirSync(group.dir, { recursive: true });

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`\n== Portraits: ${groupName} ==`);

  for (let i = 0; i < group.entries.length; i += BATCH_SIZE) {
    const batch = group.entries.slice(i, i + BATCH_SIZE);
    const byTitle = await queryThumbnails(batch);

    for (const entry of batch) {
      const dest = join(group.dir, `${entry.slug}.png`);
      const force = forceSlugs.has(entry.slug);

      if (existsSync(dest) && !force) {
        console.log(`skip ${entry.slug}`);
        skipped++;
        continue;
      }

      const normalizedTitle = entry.wiki.replace(/_/g, " ");
      const page =
        byTitle.get(normalizedTitle) ??
        [...byTitle.values()].find((p) => p.title?.replace(/\s+/g, " ") === normalizedTitle);

      const thumb = entry.url ?? page?.thumbnail?.source;
      if (!thumb) {
        console.warn(`warn ${entry.slug}: no thumbnail for ${entry.wiki}`);
        failed++;
        continue;
      }

      try {
        const url = toFullSizeUrl(thumb);
        const bytes = await downloadFile(url, dest);
        console.log(`${force ? "force" : "ok"}  ${entry.slug} (${bytes} bytes)`);
        ok++;
      } catch (err) {
        console.warn(`fail ${entry.slug}: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    if (i + BATCH_SIZE < group.entries.length) {
      await sleep(DELAY_MS);
    }
  }

  return { ok, skipped, failed };
}

async function downloadSeriesCovers(forceSlugs) {
  const outDir = join(PUBLIC, "anime-series");
  mkdirSync(outDir, { recursive: true });

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  console.log("\n== Series covers ==");

  for (let i = 0; i < SERIES_COVERS.length; i += BATCH_SIZE) {
    const batch = SERIES_COVERS.slice(i, i + BATCH_SIZE);
    const byTitle = await queryThumbnails(batch);

    for (const entry of batch) {
      const dest = join(outDir, `${entry.key}.png`);
      const force = forceSlugs.has(entry.key);

      if (existsSync(dest) && !force) {
        console.log(`skip ${entry.key}`);
        skipped++;
        continue;
      }

      const normalizedTitle = entry.wiki.replace(/_/g, " ");
      const page =
        byTitle.get(normalizedTitle) ??
        [...byTitle.values()].find((p) => p.title?.replace(/\s+/g, " ") === normalizedTitle);

      const thumb = entry.url ?? page?.thumbnail?.source;
      if (!thumb) {
        console.warn(`warn ${entry.key}: no thumbnail for ${entry.wiki}`);
        failed++;
        continue;
      }

      try {
        const url = toFullSizeUrl(thumb);
        const bytes = await downloadFile(url, dest);
        console.log(`${force ? "force" : "ok"}  ${entry.key} (${bytes} bytes)`);
        ok++;
      } catch (err) {
        console.warn(`fail ${entry.key}: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }
  }

  return { ok, skipped, failed };
}

async function main() {
  const { forceSlugs, only } = parseArgs(process.argv.slice(2));
  const totals = { ok: 0, skipped: 0, failed: 0 };

  const wantSeries = !only || only.includes("series");
  const portraitGroups = Object.entries(PORTRAIT_GROUPS).filter(
    ([name]) => !only || only.includes(name)
  );

  if (wantSeries) {
    const result = await downloadSeriesCovers(forceSlugs);
    totals.ok += result.ok;
    totals.skipped += result.skipped;
    totals.failed += result.failed;
  }

  for (const [name, group] of portraitGroups) {
    const result = await downloadPortraitBatch(name, group, forceSlugs);
    totals.ok += result.ok;
    totals.skipped += result.skipped;
    totals.failed += result.failed;
  }

  console.log(
    `\nDone: ${totals.ok} downloaded, ${totals.skipped} skipped, ${totals.failed} failed`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
