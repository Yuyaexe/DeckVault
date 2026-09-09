import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(".env.local"));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("NO_DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", prepare: false });
const files = [
  "src/lib/db/migrations/0013_anime_workspace_share.sql",
  "src/lib/db/migrations/0014_anime_invite_email_fallback.sql",
];

try {
  await sql.unsafe("CREATE SCHEMA IF NOT EXISTS private");
  for (const file of files) {
    const body = readFileSync(resolve(file), "utf8");
    console.log("Applying", file, "...");
    await sql.unsafe(body);
    console.log("OK", file);
  }
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'anime_workspace%'
    ORDER BY table_name
  `;
  console.log(
    "Tables:",
    tables.map((t) => t.table_name).join(", ") || "(none)"
  );
  const fn = await sql`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'accept_anime_workspace_invites'
  `;
  console.log("RPC:", fn.map((f) => f.routine_name).join(", ") || "(missing)");
} catch (err) {
  console.error("FAIL:", err?.message || err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
