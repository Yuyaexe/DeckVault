#!/usr/bin/env node
/**
 * DeckVault health checks — CardTrader URLs, Yu-Gi-Oh image rules, env, build.
 * Keep slug/blueprint logic aligned with src/lib/cardtrader/catalog.ts
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RESULT_FILE = join(ROOT, ".verify-result");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

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

// --- mirrored pure helpers (catalog.ts) ---
function slugifyForCardTrader(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractCardTraderSlugFromImageUrl(imageUrl) {
  if (!imageUrl) return null;
  const match = imageUrl.match(/blueprints\/(\d+-[^/?#]+)/i);
  return match?.[1] ?? null;
}

function extractBlueprintIdFromImageUrl(imageUrl) {
  const slug = extractCardTraderSlugFromImageUrl(imageUrl);
  if (!slug) return null;
  const id = Number(slug.split("-")[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isLikelyYugiohPasscodeDigits(externalId, imageUrl) {
  if (!/^\d{7,10}$/.test(externalId)) return false;
  if (imageUrl && /cardtrader\.com|product-images\.cardtrader/i.test(imageUrl)) return false;
  if (imageUrl?.includes("ygoprodeck.com")) return true;
  return externalId.length >= 8;
}

function isPlausibleCardTraderBlueprintId(id) {
  if (!Number.isFinite(id) || id <= 0) return false;
  if (id >= 10_000_000 && id <= 99_999_999) return false;
  return true;
}

function resolveStoredBlueprintId(externalId, imageUrl, cardTraderBlueprintId) {
  if (cardTraderBlueprintId && /^\d+$/.test(cardTraderBlueprintId)) {
    const explicit = Number(cardTraderBlueprintId);
    if (isPlausibleCardTraderBlueprintId(explicit)) return explicit;
  }
  const fromImage = extractBlueprintIdFromImageUrl(imageUrl);
  if (fromImage != null) return fromImage;
  if (!externalId || !/^\d+$/.test(externalId)) return null;
  if (isLikelyYugiohPasscodeDigits(externalId, imageUrl)) return null;
  const id = Number(externalId);
  return isPlausibleCardTraderBlueprintId(id) ? id : null;
}

function buildCardTraderCardUrl({ blueprintId, name, setName, rarity, imageUrl }) {
  const fromImage = extractCardTraderSlugFromImageUrl(imageUrl);
  if (fromImage) return `https://www.cardtrader.com/en/cards/${fromImage}`;
  const parts = [slugifyForCardTrader(name)];
  if (rarity?.trim()) parts.push(slugifyForCardTrader(rarity));
  if (setName?.trim()) parts.push(slugifyForCardTrader(setName));
  return `https://www.cardtrader.com/en/cards/${blueprintId}-${parts.join("-")}`;
}

function resolveCardTraderProductUrl(params) {
  const blueprintId = resolveStoredBlueprintId(
    params.externalId,
    params.imageUrl,
    params.cardTraderBlueprintId
  );
  if (blueprintId != null) {
    return buildCardTraderCardUrl({ blueprintId, ...params });
  }
  const terms = [params.name, params.setName].filter(Boolean).join(" ").trim();
  return `https://www.cardtrader.com/en/search?query=${encodeURIComponent(terms)}`;
}

function assertEqual(label, actual, expected) {
  if (actual === expected) pass(label);
  else fail(label, `expected: ${expected}\n       got:      ${actual}`);
}

function assertNotEqual(label, actual, forbidden) {
  if (actual !== forbidden) pass(label);
  else fail(label, `must not be: ${forbidden}`);
}

function assertNull(label, value) {
  if (value == null) pass(label);
  else fail(label, `expected null, got ${value}`);
}

function assertNotNull(label, value) {
  if (value != null) pass(label);
  else fail(label, "expected non-null");
}

function runLintCheck() {
  const nextCli = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const lint = spawnSync(process.execPath, [nextCli, "lint"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (lint.error) {
    fail("npm run lint", String(lint.error));
    return;
  }

  if (lint.status === 0) pass("npm run lint");
  else fail("npm run lint", (lint.stderr || lint.stdout || "").slice(0, 800));
}

async function runCardTraderApiCheck(envPath) {
  if (!existsSync(envPath)) return;

  const env = readFileSync(envPath, "utf8");
  const tokenMatch = env.match(/CARDTRADER_API_TOKEN=(.+)/);
  const token = tokenMatch?.[1]?.trim();
  if (!token) {
    warn("Skipping live API test", "No token");
    return;
  }

  try {
    const res = await fetch("https://api.cardtrader.com/api/v2/info", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const ok = res.ok;
    await res.text().catch(() => "");
    if (ok) pass(`CardTrader API reachable (${res.status})`);
    else fail("CardTrader API auth", `HTTP ${res.status}`);
  } catch (err) {
    fail("CardTrader API network", String(err));
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
  try {
    if (existsSync(RESULT_FILE)) unlinkSync(RESULT_FILE);
  } catch {
    // ignore
  }

  section("CardTrader URL logic");

  const CORRECT_SPEEDROID =
    "https://www.cardtrader.com/en/cards/201101-speedroid-scratch-secret-rare-brothers-of-legend";
  const WRONG_PASSCODE_URL =
    "https://www.cardtrader.com/en/cards/29114773-speedroid-scratch-secret-rare-brothers-of-legend";
  const cardtraderImage =
    "https://product-images.cardtrader.com/blueprints/201101-speedroid-scratch-secret-rare-brothers-of-legend/square.jpg";

  assertEqual(
    "Blueprint externalId builds correct product URL",
    resolveCardTraderProductUrl({
      name: "Speedroid Scratch",
      externalId: "201101",
      setName: "Brothers of Legend",
      rarity: "Secret Rare",
    }),
    CORRECT_SPEEDROID
  );

  assertNotEqual(
    "YGO passcode must NOT be used as blueprint id in URL",
    resolveCardTraderProductUrl({
      name: "Speedroid Scratch",
      externalId: "29114773",
      setName: "Brothers of Legend",
      rarity: "Secret Rare",
      imageUrl: "https://images.ygoprodeck.com/images/cards/29114773.jpg",
    }),
    WRONG_PASSCODE_URL
  );

  assertEqual(
    "Passcode externalId + CardTrader CDN image recovers blueprint 201101",
    resolveCardTraderProductUrl({
      name: "Speedroid Scratch",
      externalId: "29114773",
      setName: "Brothers of Legend",
      rarity: "Secret Rare",
      imageUrl: cardtraderImage,
    }),
    CORRECT_SPEEDROID
  );

  assertEqual(
    "cardTraderBlueprintId field wins over passcode externalId",
    resolveCardTraderProductUrl({
      name: "Speedroid Scratch",
      externalId: "29114773",
      cardTraderBlueprintId: "201101",
      setName: "Brothers of Legend",
      rarity: "Secret Rare",
    }),
    CORRECT_SPEEDROID
  );

  assertNull(
    "8-digit passcode alone is not a stored blueprint id",
    resolveStoredBlueprintId("29114773", "https://images.ygoprodeck.com/images/cards/29114773.jpg")
  );

  assertNotNull(
    "6-digit blueprint id is recognized",
    resolveStoredBlueprintId("201101", null)
  );

  assertEqual(
    "Search fallback omits collector number (no BROL-EN035)",
    resolveCardTraderProductUrl({
      name: "Speedroid Scratch",
      externalId: null,
      setName: "Brothers of Legend",
    }),
    "https://www.cardtrader.com/en/search?query=Speedroid%20Scratch%20Brothers%20of%20Legend"
  );

  section("Trusted image hosts");

  const TRUSTED_IMAGE_HOST_SUFFIXES = [
    "ygoprodeck.com",
    "limitlesstcg.com",
    "digimoncard.io",
    "digimoncard.com",
    "world.digimoncard.com",
    "dbs-cardgame.com",
    "pokemontcg.io",
    "pokemoncard.io",
    "digitaloceanspaces.com",
    "cardtrader.com",
    "product-images.cardtrader.com",
    "tcgplayer.com",
    "static.wikia.nocookie.net",
    "wikia.nocookie.net",
    "wikimedia.org",
    "upload.wikimedia.org",
  ];

  function isTrustedImageHost(hostname) {
    const host = hostname.toLowerCase();
    return TRUSTED_IMAGE_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  }

  function isTrustedImageUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") return false;
      return isTrustedImageHost(url.hostname);
    } catch {
      return false;
    }
  }

  if (isTrustedImageUrl("https://images.ygoprodeck.com/images/cards/123.jpg")) {
    pass("Trusted YGOProDeck host accepted");
  } else {
    fail("Trusted YGOProDeck host accepted", "expected trusted");
  }
  if (!isTrustedImageUrl("https://evil-ygoprodeck.com/image.jpg")) {
    pass("Substring host bypass rejected");
  } else {
    fail("Substring host bypass rejected", "evil host was accepted");
  }
  if (isTrustedImageUrl("https://product-images.tcgplayer.com/fallback.jpg")) {
    pass("TCGPlayer host accepted");
  } else {
    fail("TCGPlayer host accepted", "expected trusted");
  }

  section("CSV condition / language mapping");

  const CONDITION_ALIASES = {
    nm: "NM",
    "near mint": "NM",
    lp: "LP",
    "lightly played": "LP",
    mp: "MP",
    "moderately played": "MP",
    hp: "HP",
    "heavily played": "HP",
    dmg: "DMG",
    damaged: "DMG",
  };

  const LANGUAGE_ALIASES = {
    en: "EN",
    english: "EN",
    jp: "JP",
    japanese: "JP",
    pt: "PT",
    portuguese: "PT",
  };

  function normalizeCardCondition(raw) {
    if (!raw?.trim()) return "NM";
    const key = raw.trim().toLowerCase();
    if (["NM", "LP", "MP", "HP", "DMG"].includes(raw.trim())) return raw.trim();
    return CONDITION_ALIASES[key] ?? "NM";
  }

  function normalizeCardLanguage(raw) {
    if (!raw?.trim()) return "EN";
    const key = raw.trim().toLowerCase();
    if (["EN", "JP", "PT", "DE", "FR", "ES", "IT", "KO", "ZH"].includes(raw.trim())) {
      return raw.trim();
    }
    return LANGUAGE_ALIASES[key] ?? "EN";
  }

  assertEqual('CSV "Lightly Played" maps to LP', normalizeCardCondition("Lightly Played"), "LP");
  assertEqual('CSV "Near Mint" maps to NM', normalizeCardCondition("Near Mint"), "NM");
  assertEqual('CSV "English" maps to EN', normalizeCardLanguage("English"), "EN");
  assertEqual("Unknown condition defaults to NM", normalizeCardCondition("Minty Fresh"), "NM");

  section("Environment");

  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    warn(".env.local missing", "Demo mode only — CardTrader prices/links need CARDTRADER_API_TOKEN");
  } else {
    pass(".env.local exists");
    const env = readFileSync(envPath, "utf8");
    if (/CARDTRADER_API_TOKEN=\s*\S+/.test(env)) {
      pass("CARDTRADER_API_TOKEN is set");
    } else {
      warn("CARDTRADER_API_TOKEN empty", "CardTrader search/pricing disabled");
    }
    if (/NEXT_PUBLIC_SUPABASE_URL=\s*\S+/.test(env)) {
      pass("Supabase URL configured");
    } else {
      pass("Supabase not configured (demo mode OK)");
    }
  }

  section("Node.js & dependencies");

  const nodeVer = process.version;
  const nodeMajor = Number(nodeVer.slice(1).split(".")[0]);
  if (nodeMajor >= 20) pass(`Node.js ${nodeVer}`);
  else fail(`Node.js ${nodeVer}`, "Node 20+ required");

  if (existsSync(join(ROOT, "node_modules"))) pass("node_modules present");
  else fail("node_modules missing", "Run: npm install");

  section("TypeScript / ESLint");
  runLintCheck();

  section("Optional: live CardTrader API");
  await runCardTraderApiCheck(envPath);

  section("Summary");
  console.log(
    `\n${GREEN}${passed} passed${RESET}, ${failed ? RED + failed + " failed" + RESET : "0 failed"}, ${warnings ? YELLOW + warnings + " warnings" + RESET : "0 warnings"}\n`
  );

  return failed > 0 ? 1 : 0;
}

main()
  .then((exitCode) => {
    writeResult(exitCode);
    process.exitCode = exitCode;
  })
  .catch((err) => {
    console.error(err);
    writeResult(1);
    process.exitCode = 1;
  });
