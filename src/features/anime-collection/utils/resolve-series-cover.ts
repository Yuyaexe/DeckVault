import { getBundledSeriesCoverPath } from "@/features/anime-collection/data/anime-series-covers";
import { resolveAnimeSeriesAssetKey } from "@/features/anime-collection/data/anime-series-key";

/** User override first, then bundled local cover for known Yu-Gi-Oh! series. */
export function resolveSeriesCoverUrl(
  seriesSlug: string,
  seriesName: string | undefined,
  storedCoverUrl: string | null | undefined
): string | null {
  const trimmed = storedCoverUrl?.trim();
  if (trimmed) return trimmed;

  const key = resolveAnimeSeriesAssetKey(seriesSlug, seriesName);
  if (!key) return null;

  return getBundledSeriesCoverPath(key);
}
