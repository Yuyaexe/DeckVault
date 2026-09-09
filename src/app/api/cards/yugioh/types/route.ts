import { NextRequest, NextResponse } from "next/server";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";

const API = "https://db.ygoprodeck.com/api/v7";
const HEADERS = { Accept: "application/json", "User-Agent": "DeckVault/0.2" };
const MAX_IDS = 100;
const MAX_NAMES = 40;

interface YgoTypeRow {
  id: number;
  name?: string;
  type?: string;
}

function indexTypes(
  cards: YgoTypeRow[],
  types: Record<string, string>,
  keysByPasscode: Map<string, string[]>
) {
  for (const card of cards) {
    if (!card.type?.trim()) continue;
    const type = card.type.trim();
    const raw = String(card.id);
    const padded = raw.padStart(8, "0");
    types[raw] = type;
    types[padded] = type;
    for (const key of keysByPasscode.get(raw) ?? []) types[key] = type;
    for (const key of keysByPasscode.get(padded) ?? []) types[key] = type;
    if (card.name?.trim()) {
      types[`name:${card.name.trim().toLowerCase()}`] = type;
    }
  }
}

/**
 * Batch-resolve YGOPRODeck type strings.
 * Body: { ids?: string[], names?: string[], cards?: { key: string, id?: string, name?: string }[] }
 * Returns { types: Record<string, string> } keyed by passcode, `name:…`, and optional card keys.
 */
export async function POST(request: NextRequest) {
  let body: {
    ids?: unknown;
    names?: unknown;
    cards?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const types: Record<string, string> = {};
  const keysByPasscode = new Map<string, string[]>();
  const passcodes = new Set<string>();
  const names = new Set<string>();
  const nameKeys = new Map<string, string[]>();

  const addPasscode = (id: string, key?: string) => {
    if (!isYugiohPasscodeId(id, null)) return;
    passcodes.add(id);
    passcodes.add(id.replace(/^0+/, "") || id);
    passcodes.add(id.padStart(8, "0"));
    if (key) {
      const list = keysByPasscode.get(id) ?? [];
      list.push(key);
      keysByPasscode.set(id, list);
      keysByPasscode.set(id.padStart(8, "0"), list);
    }
  };

  const addName = (name: string, key?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    names.add(trimmed);
    if (key) {
      const nk = trimmed.toLowerCase();
      const list = nameKeys.get(nk) ?? [];
      list.push(key);
      nameKeys.set(nk, list);
    }
  };

  if (Array.isArray(body.cards)) {
    for (const row of body.cards) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { key?: unknown; id?: unknown; name?: unknown };
      const key = typeof rec.key === "string" ? rec.key : null;
      if (typeof rec.id === "string") addPasscode(rec.id.trim(), key ?? undefined);
      if (typeof rec.name === "string") addName(rec.name, key ?? undefined);
    }
  }

  if (Array.isArray(body.ids)) {
    for (const id of body.ids) {
      if (typeof id === "string") addPasscode(id.trim());
    }
  }

  if (Array.isArray(body.names)) {
    for (const name of body.names) {
      if (typeof name === "string") addName(name);
    }
  }

  const idList = [...passcodes].filter((id) => isYugiohPasscodeId(id, null)).slice(0, MAX_IDS);
  const nameList = [...names].slice(0, MAX_NAMES);

  try {
    if (idList.length > 0) {
      const params = new URLSearchParams({ id: idList.join(",") });
      const res = await fetch(`${API}/cardinfo.php?${params}`, { headers: HEADERS });
      if (res.ok) {
        const data = (await res.json()) as { data?: YgoTypeRow[] };
        indexTypes(data.data ?? [], types, keysByPasscode);
      }
    }

    for (const name of nameList) {
      const params = new URLSearchParams({ name });
      const res = await fetch(`${API}/cardinfo.php?${params}`, { headers: HEADERS });
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: YgoTypeRow[] };
      const card = data.data?.[0];
      if (!card?.type?.trim()) continue;
      const type = card.type.trim();
      const nameKey = `name:${name.toLowerCase()}`;
      types[nameKey] = type;
      for (const key of nameKeys.get(name.toLowerCase()) ?? []) {
        types[key] = type;
      }
      if (card.id != null) {
        types[String(card.id)] = type;
        types[String(card.id).padStart(8, "0")] = type;
      }
    }

    return NextResponse.json({ types });
  } catch {
    return NextResponse.json({ types: {} });
  }
}
