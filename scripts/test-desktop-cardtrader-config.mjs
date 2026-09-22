import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let configModule = null;
try {
  configModule = require("../electron/cardtrader-config.cjs");
} catch {
  // The first test run intentionally proves that the storage module is missing.
}

test("CardTrader token stays in the Windows profile and outside the repository", async () => {
  assert.ok(configModule, "desktop CardTrader configuration module must exist");
  const directory = await mkdtemp(path.join(os.tmpdir(), "deckvault-cardtrader-"));
  const projectDirectory = path.resolve(import.meta.dirname, "..");
  try {
    const file = configModule.getCardTraderConfigPath(directory);
    assert.equal(file.startsWith(directory), true);
    assert.equal(file.startsWith(projectDirectory), false);

    await configModule.saveCardTraderToken(directory, "  private-token  ");
    assert.equal(await configModule.loadCardTraderToken(directory), "private-token");
    assert.equal(JSON.parse(await readFile(file, "utf8")).token, "private-token");

    await configModule.removeCardTraderToken(directory);
    assert.equal(await configModule.loadCardTraderToken(directory), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
