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
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: "require",
  prepare: false,
});

try {
  await sql.unsafe("GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated");
  await sql.unsafe(
    "GRANT EXECUTE ON FUNCTION private.user_can_access_anime_workspace(uuid) TO authenticated, service_role"
  );
  await sql.unsafe(
    "GRANT EXECUTE ON FUNCTION private.user_can_edit_anime_workspace(uuid) TO authenticated, service_role"
  );
  await sql.unsafe(
    "GRANT EXECUTE ON FUNCTION private.user_owns_anime_workspace(uuid) TO authenticated, service_role"
  );
  await sql.unsafe(
    "GRANT EXECUTE ON FUNCTION public.accept_anime_workspace_invites() TO authenticated, service_role"
  );
  await sql.unsafe("NOTIFY pgrst, 'reload schema'");
  console.log("Grants refreshed + PostgREST schema reload notified");
} catch (err) {
  console.error("FAIL:", err?.message || err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
