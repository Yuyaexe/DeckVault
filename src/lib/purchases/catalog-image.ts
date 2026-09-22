import { getCardAdapter } from "@/features/catalog/services/card-api";

function normalizeCardName(name: string): string {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

const catalogImageCache = new Map<string, { imageUrl: string | null; expiresAt: number }>();
const catalogImageInflight = new Map<string, Promise<string | null>>();

export async function getCatalogImage(name: string, gameId: number | null): Promise<string | null> {
  const gameSlug = gameId === 8 ? "digimon" : gameId === 4 ? "yugioh" : null;
  if (!gameSlug) return null;
  const key = `${gameSlug}:${normalizeCardName(name)}`;
  const cached = catalogImageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.imageUrl;
  const pending = catalogImageInflight.get(key);
  if (pending) return pending;

  const lookup = (async () => {
    try {
      const adapter = getCardAdapter(gameSlug);
      if (!adapter) return null;
      const results = await adapter.search(name);
      const normalized = normalizeCardName(name);
      const match = results.find((result) => normalizeCardName(result.name) === normalized);
      const imageUrl = match?.imageUrl ?? null;
      catalogImageCache.set(key, {
        imageUrl, expiresAt: Date.now() + (imageUrl ? 86_400_000 : 60_000),
      });
      return imageUrl;
    } catch {
      return null;
    } finally {
      catalogImageInflight.delete(key);
    }
  })();
  catalogImageInflight.set(key, lookup);
  return lookup;
}
