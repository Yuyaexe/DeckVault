import { readPasscodeEntries, writePasscodeEntries } from "@/lib/cache/idb";
import { PASSCODE_CACHE_TTL_MS } from "@/lib/cache/constants";
import {
  yugiohPasscodeCacheKey,
  type YugiohPasscodeKeyInput,
} from "@/lib/yugioh/passcode-key";

export async function readCachedPasscode(
  card: YugiohPasscodeKeyInput
): Promise<string | null | undefined> {
  const key = yugiohPasscodeCacheKey(card);
  const entries = await readPasscodeEntries([key], PASSCODE_CACHE_TTL_MS);
  const entry = entries.get(key);
  if (!entry) return undefined;
  return entry.passcode;
}

export async function writeCachedPasscode(
  card: YugiohPasscodeKeyInput,
  passcode: string | null
): Promise<void> {
  await writePasscodeEntries([{ key: yugiohPasscodeCacheKey(card), passcode }]);
}

export async function readCachedPasscodesForCards(
  cards: YugiohPasscodeKeyInput[],
  maxAgeMs = PASSCODE_CACHE_TTL_MS
): Promise<Map<string, string | null>> {
  const keys = [...new Set(cards.map((card) => yugiohPasscodeCacheKey(card)))];
  const entries = await readPasscodeEntries(keys, maxAgeMs);
  const out = new Map<string, string | null>();
  for (const card of cards) {
    const key = yugiohPasscodeCacheKey(card);
    const entry = entries.get(key);
    if (entry) out.set(key, entry.passcode);
  }
  return out;
}
