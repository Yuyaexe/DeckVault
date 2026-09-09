export function parseCharacterList(
  text: string,
  existingNames: string[]
): { names: string[]; skipped: number } {
  const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  const names: string[] = [];
  let skipped = 0;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key) || existingLower.has(key)) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    names.push(trimmed);
  }

  return { names, skipped };
}
