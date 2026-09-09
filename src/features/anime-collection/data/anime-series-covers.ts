import type { AnimeSeriesAssetKey } from "@/features/anime-collection/data/anime-series-key";

export const ANIME_SERIES_COVER_BASE_PATH = "/anime-series";

export const BUNDLED_ANIME_SERIES_COVERS: AnimeSeriesAssetKey[] = [
  "yu-gi-oh",
  "yu-gi-oh-gx",
  "yu-gi-oh-5ds",
  "yu-gi-oh-zexal",
  "yu-gi-oh-arc-v",
  "yu-gi-oh-vrains",
];

export function getBundledSeriesCoverPath(key: AnimeSeriesAssetKey): string {
  return `${ANIME_SERIES_COVER_BASE_PATH}/${key}.png`;
}
