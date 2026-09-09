#!/usr/bin/env node
/**
 * Validates CT app backups (Tools/CT) and DeckVault restore conversion.
 * Uses the real parseBackupJson via tsx (same code path as Settings → Restaurar backup).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RESULT_FILE = join(ROOT, ".verify-backup-result");
const RUNNER = join(__dirname, "verify-backup-import-runner.ts");
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

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

const CT_BACKUP_DIR = join(
  process.env.USERPROFILE || "",
  "OneDrive",
  "Desktop",
  "Tools",
  "CT",
  "backup"
);

function listCtJsonBackups(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^yugioh-(backup|collection)-.*\.json$/i.test(name))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function findDefaultBackupFile() {
  const explicit = process.argv[2];
  if (explicit) return resolve(explicit);

  for (const dir of [CT_BACKUP_DIR, ROOT]) {
    const files = listCtJsonBackups(dir);
    if (files.length > 0) return files[0];
  }

  return null;
}

function countSourceCards(raw) {
  let count = 0;

  function addQty(item) {
    count += Math.max(1, item?.quantity ?? 1);
  }

  function walk(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item?.type === "folder" && Array.isArray(item.items)) {
        walk(item.items);
      } else if (item?.type === "card" && item?.name) {
        addQty(item);
      } else if (item?.card?.name) {
        addQty(item);
      } else if (item?.blueprintId && item?.name) {
        addQty(item);
      }
    }
  }

  if (raw?.backupVersion === 1 && raw?.collection?.tabs) {
    for (const tab of raw.collection.tabs) walk(tab.items);
    return count;
  }

  if (Array.isArray(raw?.items)) {
    walk(raw.items);
    return count;
  }

  return raw?.ownedCards?.length ?? 0;
}

function detectSourceFormat(raw) {
  if (raw?.backupVersion === 1 && raw?.collection?.tabs) {
    return "CT full backup (backupVersion 1)";
  }
  if (raw?.exportVersion === 2) return "CT tab export (exportVersion 2)";
  if (raw?.exportVersion === 1) return "CT tab export (exportVersion 1)";
  if (raw?.version === "1.0") return "DeckVault nativo";
  return "desconhecido";
}

function runConverter(filePath) {
  const tsxCli = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxCli)) {
    return { error: "tsx nao instalado — rode npm install" };
  }

  const tsx = spawnSync(process.execPath, [tsxCli, RUNNER, filePath], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (tsx.error) {
    return { error: String(tsx.error) };
  }

  if (tsx.status !== 0) {
    return {
      error: (tsx.stderr || tsx.stdout || "tsx failed").trim().slice(0, 1200),
    };
  }

  try {
    return { data: JSON.parse(tsx.stdout.trim()) };
  } catch {
    return { error: `Invalid runner output: ${tsx.stdout?.slice(0, 200)}` };
  }
}

function main() {
  try {
    if (existsSync(RESULT_FILE)) unlinkSync(RESULT_FILE);
  } catch {
    // ignore
  }

  const filePath = findDefaultBackupFile();

  if (!filePath) {
    fail(
      "Arquivo encontrado",
      `Nenhum yugioh-backup-*.json ou yugioh-collection-*.json em:\n       ${CT_BACKUP_DIR}\n       ${ROOT}\n       Passe o caminho: npm run verify:backup -- caminho\\arquivo.json`
    );
    return finish(1);
  }

  const fileName = filePath.split(/[/\\]/).pop();

  section("Arquivo de backup");
  console.log(`  Arquivo: ${fileName}`);
  console.log(`  Caminho: ${filePath}`);

  if (!existsSync(filePath)) {
    fail("Arquivo existe", filePath);
    return finish(1);
  }
  pass("Arquivo existe");

  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    fail("JSON valido", String(err));
    return finish(1);
  }
  pass("JSON parse OK");

  const sizeMb = (readFileSync(filePath).length / (1024 * 1024)).toFixed(2);
  console.log(`  Tamanho: ${sizeMb} MB`);
  if (Number(sizeMb) > 2) {
    warn("Arquivo grande", "Imagens base64 em pastas aumentam o tamanho — a conversao remove isso no app");
  }

  section("Formato de origem (app CT — Tools/CT)");

  const format = detectSourceFormat(raw);
  console.log(`  Formato: ${format}`);

  const isCtFull =
    raw?.backupVersion === 1 && raw?.collection && Array.isArray(raw.collection.tabs);
  const isCtTab = raw?.exportVersion === 1 || raw?.exportVersion === 2;
  const isDeckVault = raw?.version === "1.0" && Array.isArray(raw.collections);

  if (isCtFull) {
    pass("backupVersion: 1 com collection.tabs");
    const tabNames = raw.collection.tabs.map((t) => t.name?.trim() || "(sem nome)");
    pass(`Abas: ${tabNames.join(", ")}`);
  } else if (isCtTab) {
    pass(`exportVersion: ${raw.exportVersion} (export de aba)`);
    if (raw.tabName) pass(`Aba: ${raw.tabName}`);
  } else if (isDeckVault) {
    pass("Formato DeckVault nativo (version 1.0)");
  } else {
    fail(
      "Formato reconhecido",
      "Esperado backup CT (backupVersion 1 ou exportVersion 1/2) ou DeckVault 1.0"
    );
    return finish(1);
  }

  const sourceCardCount = countSourceCards(raw);
  if (sourceCardCount > 0) {
    pass(`${sourceCardCount} cartas no arquivo de origem`);
  } else {
    fail("Contagem de cartas na origem", "Nenhuma carta encontrada");
    return finish(1);
  }

  section("Conversao (parseBackupJson — mesmo codigo do app)");

  const converted = runConverter(filePath);
  if (converted.error) {
    fail("Conversao TypeScript", converted.error);
    return finish(1);
  }

  const data = converted.data;

  if (data.version === "1.0") pass("Versao DeckVault: 1.0");
  else fail("Versao DeckVault", String(data.version));

  if (data.totalQuantity === sourceCardCount) {
    pass(
      `Quantidade total: ${data.totalQuantity} (${data.cardCount} linhas unicas apos merge)`
    );
  } else {
    fail(
      "Quantidade total",
      `origem ${sourceCardCount}, convertido ${data.totalQuantity}`
    );
  }

  if (data.collections.length >= 1) {
    pass(
      `${data.collections.length} colecoes: ${data.collections.map((c) => c.name).join(", ")}`
    );
  } else {
    fail("Colecoes", "Nenhuma coleção gerada");
  }

  const defaultCols = data.collections.filter((c) => c.isDefault);
  if (defaultCols.length === 1) pass("Exatamente 1 coleção padrão");
  else fail("Coleção padrão", `esperado 1, encontrado ${defaultCols.length}`);

  if (data.currency === "BRL" || data.currency === "USD") {
    pass(`Moeda: ${data.currency}`);
  } else {
    warn("Moeda", String(data.currency));
  }

  if (data.invalidCollectionRefs === 0) pass("Referencias collectionId validas");
  else fail("Referencias collectionId", `${data.invalidCollectionRefs} invalidas`);

  if (data.missingName === 0) pass("Todas as cartas tem nome");
  else fail("Nomes de cartas", `${data.missingName} sem nome`);

  if (data.missingExternalId === 0) pass("Todas as cartas tem externalId / blueprint");
  else warn("Blueprint ID", `${data.missingExternalId} cartas sem ID externo`);

  if (data.missingImage === 0) pass("Todas as cartas tem imageUrl");
  else warn("Imagens", `${data.missingImage} cartas sem imagem`);

  const payloadKb = Math.round(data.payloadBytes / 1024);
  if (data.payloadBytes <= MAX_PAYLOAD_BYTES) {
    pass(`Payload API pos-conversao: ${payloadKb} KB (limite ~4 MB)`);
  } else {
    fail("Payload API", `${payloadKb} KB excede ${MAX_PAYLOAD_BYTES / 1024 / 1024} MB`);
  }

  section("Modo Supabase (opcional)");
  const envPath = join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    if (/NEXT_PUBLIC_SUPABASE_URL=\s*\S+/.test(env)) {
      pass("Supabase configurado — restore via Settings no app");
      console.log("       Este script NAO envia dados ao servidor.");
      console.log("       Se passar aqui, importe em Settings → Restaurar backup.");
    } else {
      pass("Modo demo (sem Supabase) — restore e local no navegador");
    }
  } else {
    pass("Modo demo — sem .env.local");
  }

  section("Resumo");
  console.log(
    `\n${GREEN}${passed} passed${RESET}, ${failed ? RED + failed + " failed" + RESET : "0 failed"}, ${warnings ? YELLOW + warnings + " warnings" + RESET : "0 warnings"}\n`
  );

  if (failed === 0) {
    console.log(`${GREEN}Backup CT pronto para importar no DeckVault.${RESET}`);
    console.log(`  Settings → Restaurar backup → selecione o arquivo`);
    console.log(`  Origem CT: ${CT_BACKUP_DIR}\n`);
  }

  return finish(failed > 0 ? 1 : 0);
}

function finish(exitCode) {
  try {
    writeFileSync(RESULT_FILE, exitCode === 0 ? "PASS" : "FAIL", "utf8");
  } catch {
    // ignore
  }
  process.exitCode = exitCode;
  return exitCode;
}

main();
