import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("the repair installer uses a new Windows installation identity", () => {
  assert.equal(packageJson.build.appId, "com.deckvault.desktop");
  assert.equal(packageJson.build.win.executableName, "DeckVault Desktop");
  assert.equal(packageJson.build.productName, "DeckVault");
});

test("the installer and lockfile versions agree", async () => {
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(packageJson.version, lock.version);
  assert.equal(packageJson.version, lock.packages[""].version);
});
