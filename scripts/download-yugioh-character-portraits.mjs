#!/usr/bin/env node
/** @deprecated Use scripts/download-anime-assets.mjs */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const script = join(dirname(fileURLToPath(import.meta.url)), "download-anime-assets.mjs");
const result = spawnSync(process.execPath, [script, "--only", "dm", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
