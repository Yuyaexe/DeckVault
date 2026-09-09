#!/usr/bin/env node
/**
 * Yu-Gi-Oh passcode + image resolution smoke test.
 * Hits /api/cards/yugioh/resolve-batch and /api/cards/yugioh/resolve on the local app.
 *
 * Usage:
 *   node scripts/test-yugioh-passcodes.mjs
 *   node scripts/test-yugioh-passcodes.mjs --base-url http://localhost:3000
 *   node scripts/test-yugioh-passcodes.mjs --random 12
 */

import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RESULT_FILE = join(ROOT, ".ygo-test-result");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const YGO_API = "https://db.ygoprodeck.com/api/v7";
const YGO_HEADERS = { Accept: "application/json", "User-Agent": "DeckVault/0.2" };

/** Always run — known regressions from wrong CardTrader / passcode mapping. */
const REGRESSION_CASES = [
  {
    id: "reg-draco",
    name: "Draco Berserker of the Tenyi",
    collectorNumber: "MP20-EN229",
    wrongImageName: "Soul Release",
  },
  {
    id: "reg-mirrorjade",
    name: "Mirrorjade the Iceblade Dragon",
    collectorNumber: "BLTR-EN114",
  },
  {
    id: "reg-vessel",
    name: "Vessel for the Dragon Cycle",
    collectorNumber: "MP20-EN131",
  },
  {
    id: "reg-speedroid",
    name: "Speedroid Scratch",
    collectorNumber: "BROL-EN035",
  },
];

/** Pool for random picks each run (passcode validated via resolve + image only). */
const RANDOM_POOL = [
  { name: "Ash Blossom & Joyous Spring", collectorNumber: "MP17-EN146" },
  { name: "Dark Magician", collectorNumber: "SDY-006" },
  { name: "Blue-Eyes White Dragon", collectorNumber: "LOB-EN001" },
  { name: "Maxx \"C\"", collectorNumber: "SDOK-EN021" },
  { name: "Nibiru, the Primal Being", collectorNumber: "TN19-EN013" },
  { name: "Accesscode Talker", collectorNumber: "ETCO-EN051" },
  { name: "Terraforming", collectorNumber: "SR03-EN026" },
  { name: "Polymerization", collectorNumber: "SDY-026" },
  { name: "Pot of Greed", collectorNumber: "LOB-EN118" },
  { name: "Raigeki", collectorNumber: "LOB-EN053" },
  { name: "Dramaturge of Despia", collectorNumber: "MP22-EN261" },
  { name: "Albion the Branded Dragon", collectorNumber: "PHRA-EN033" },
  { name: "Swordsoul of Mo Ye", collectorNumber: "BODE-EN004" },
  { name: "Kashtira Unicorn", collectorNumber: "DABL-EN013" },
  { name: "Snake-Eye Ash", collectorNumber: "PHNI-EN003" },
  { name: "Tenyi Spirit - Adhara", collectorNumber: "RIRA-EN016" },
  { name: "Odd-Eyes Pendulum Dragon", collectorNumber: "YSYR-EN001" },
  { name: "Solemn Judgment", collectorNumber: "SDY-046" },
  { name: "Infinite Impermanence", collectorNumber: "FLOD-EN078" },
  { name: "Called by the Grave", collectorNumber: "FLOD-EN065" },
  { name: "Tearlaments Reinoheart", collectorNumber: "POTE-EN011" },
  { name: "Rainbow Dragon", collectorNumber: "TAEV-EN006" },
  { name: "Effect Veiler", collectorNumber: "SDOK-EN002" },
  { name: "Monster Reborn", collectorNumber: "SDY-029" },
];

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(label) {
  passed++;
  console.log(`${GREEN}  OK${RESET}  ${label}`);
}

function fail(label, detail) {
  failed++;
  console.log(`${RED} FAIL${RESET}  ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function warn(label, detail) {
  warnings++;
  console.log(`${YELLOW} WARN${RESET}  ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function section(title) {
  console.log(`\n${CYAN}== ${title} ==${RESET}`);
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

async function fetchYgoPasscodeByName(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const res = await fetch(
    `${YGO_API}/cardinfo.php?fname=${encodeURIComponent(trimmed)}`,
    { headers: YGO_HEADERS, signal: AbortSignal.timeout(30_000) }
  );
  if (!res.ok) return null;

  const json = await res.json();
  const cards = Array.isArray(json.data) ? json.data : [];
  const match = cards.find((card) => namesMatch(card.name, trimmed));
  return match ? String(match.id) : null;
}

async function fetchYgoCardNameByPasscode(passcode) {
  const res = await fetch(`${YGO_API}/cardinfo.php?id=${passcode}`, {
    headers: YGO_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0]?.name ?? null;
}

/** Attach YGOPRODeck truth passcodes before hitting DeckVault APIs. */
async function enrichRegressionCases(cases) {
  return Promise.all(
    cases.map(async (card) => {
      const expectedPasscode = await fetchYgoPasscodeByName(card.name);
      const wrongPasscode = card.wrongImageName
        ? await fetchYgoPasscodeByName(card.wrongImageName)
        : null;
      return { ...card, expectedPasscode, wrongPasscode };
    })
  );
}

function buildYgoImageUrl(passcode, size = "cards") {
  return `https://images.ygoprodeck.com/images/${size}/${passcode}.jpg`;
}

function parseArgs(argv) {
  const args = { baseUrl: process.env.DECKVAULT_BASE_URL ?? "http://localhost:3000", random: 24 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--base-url" && argv[i + 1]) {
      args.baseUrl = argv[++i].replace(/\/$/, "");
    } else if (argv[i] === "--random" && argv[i + 1]) {
      args.random = Math.max(0, Number(argv[++i]) || 10);
    }
  }
  return args;
}

function pickRandom(pool, count) {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

async function waitForServer(baseUrl, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function resolveSingle(baseUrl, card) {
  const params = new URLSearchParams();
  if (card.collectorNumber) params.set("set", card.collectorNumber);
  if (card.name) params.set("name", card.name);
  const res = await fetch(`${baseUrl}/api/cards/yugioh/resolve?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.result ?? null;
}

async function resolveBatch(baseUrl, cards) {
  const res = await fetch(`${baseUrl}/api/cards/yugioh/resolve-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cards: cards.map((c) => ({
        id: c.id,
        name: c.name,
        setCode: c.setCode ?? null,
        collectorNumber: c.collectorNumber ?? null,
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Batch HTTP ${res.status}`);
  const json = await res.json();
  return json.passcodes ?? {};
}

async function imageReachable(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    if (res.ok) return true;
    const getRes = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15_000) });
    return getRes.ok;
  } catch {
    return false;
  }
}

function writeResult(exitCode) {
  try {
    writeFileSync(RESULT_FILE, exitCode === 0 ? "PASS" : "FAIL", "utf8");
  } catch {
    // ignore
  }
}

async function main() {
  const { baseUrl, random } = parseArgs(process.argv);

  try {
    if (existsSync(RESULT_FILE)) unlinkSync(RESULT_FILE);
  } catch {
    // ignore
  }

  console.log(`${CYAN}DeckVault — Teste Yu-Gi-Oh passcodes / imagens${RESET}`);
  console.log(`${DIM}Base URL: ${baseUrl}${RESET}\n`);

  section("Servidor");
  const serverUp = await waitForServer(baseUrl, 30);
  if (!serverUp) {
    fail(
      "Servidor local",
      `Nao respondeu em ${baseUrl}. Rode DeckVault.bat ou: npm run dev`
    );
    return 1;
  }
  pass(`Servidor respondeu (${baseUrl})`);

  section("Referencia YGOPRODeck (passcodes esperados)");
  const regressionCases = await enrichRegressionCases(REGRESSION_CASES);
  for (const card of regressionCases) {
    const setRef = card.collectorNumber ?? "—";
    if (!card.expectedPasscode) {
      fail(`Referencia YGO — ${card.name}`, "passcode nao encontrado no YGOPRODeck");
    } else {
      pass(`${card.name} [${setRef}] → ${card.expectedPasscode}`);
    }
  }

  const randomCases = pickRandom(RANDOM_POOL, random).map((c, i) => ({
    ...c,
    id: `rnd-${i}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
  }));
  const testCards = [...regressionCases, ...randomCases];

  section(`Cartas (${regressionCases.length} regressao + ${randomCases.length} aleatorias)`);
  for (const card of testCards) {
    const setRef = card.collectorNumber ?? card.setCode ?? "—";
    console.log(`  • ${card.name} ${DIM}(${setRef})${RESET}`);
  }

  section("Batch resolve — POST /api/cards/yugioh/resolve-batch");
  let batchPasscodes;
  try {
    batchPasscodes = await resolveBatch(baseUrl, testCards);
    pass(`Batch retornou ${Object.keys(batchPasscodes).length} passcodes`);
  } catch (err) {
    fail("Batch resolve", String(err));
    return 1;
  }

  for (const card of testCards) {
    const passcode = batchPasscodes[card.id] ?? null;
    const label = `${card.name} [${card.collectorNumber ?? card.setCode ?? "sem set"}]`;

    if (!passcode) {
      fail(`Passcode resolvido — ${label}`, "null");
      continue;
    }

    if (card.expectedPasscode && passcode !== card.expectedPasscode) {
      const resolvedName = await fetchYgoCardNameByPasscode(passcode);
      fail(
        `Passcode esperado — ${label}`,
        `esperado ${card.expectedPasscode}, recebido ${passcode}${resolvedName ? ` (${resolvedName})` : ""}`
      );
      continue;
    }

    if (card.wrongPasscode && passcode === card.wrongPasscode) {
      fail(
        `Passcode nao pode ser imagem errada — ${label}`,
        `recebeu passcode de ${card.wrongImageName ?? "carta errada"} (${passcode})`
      );
      continue;
    }

    pass(`Passcode — ${label} → ${passcode}`);
  }

  section("Resolve individual — GET /api/cards/yugioh/resolve (amostra)");
  const sample = [...regressionCases.slice(0, 2), ...randomCases.slice(0, 2)];
  for (const card of sample) {
    const result = await resolveSingle(baseUrl, card);
    const label = `${card.name} [${card.collectorNumber ?? "—"}]`;
    if (!result?.externalId) {
      fail(`Resolve individual — ${label}`, "sem resultado");
      continue;
    }
    if (!namesMatch(result.name, card.name)) {
      fail(
        `Nome bate — ${label}`,
        `API retornou "${result.name}" (passcode ${result.externalId})`
      );
      continue;
    }
    if (batchPasscodes[card.id] && result.externalId !== batchPasscodes[card.id]) {
      fail(
        `Batch = individual — ${label}`,
        `batch ${batchPasscodes[card.id]} vs individual ${result.externalId}`
      );
      continue;
    }
    pass(`Resolve individual — ${label} → ${result.externalId}`);
  }

  section("Imagens YGOPRODeck (HEAD)");
  const imageSample = testCards.filter((c) => batchPasscodes[c.id]).slice(0, 12);
  for (const card of imageSample) {
    const passcode = batchPasscodes[card.id];
    const url = buildYgoImageUrl(passcode);
    const ok = await imageReachable(url);
    if (ok) pass(`Imagem OK — ${card.name}`);
    else fail(`Imagem OK — ${card.name}`, url);
  }

  section("Resumo");
  console.log(
    `\n${GREEN}${passed} passed${RESET}, ${failed ? RED + failed + " failed" + RESET : "0 failed"}, ${warnings ? YELLOW + warnings + " warnings" + RESET : "0 warnings"}\n`
  );

  if (failed === 0) {
    console.log(`${GREEN}Todas as cartas testadas resolveram passcode e imagem corretamente.${RESET}\n`);
  } else {
    console.log(`${RED}Algumas cartas falharam — confira a saida acima.${RESET}\n`);
  }

  return failed > 0 ? 1 : 0;
}

main()
  .then((code) => {
    writeResult(code);
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    writeResult(1);
    process.exitCode = 1;
  });
