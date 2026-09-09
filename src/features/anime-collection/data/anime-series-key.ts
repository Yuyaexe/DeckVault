import { slugifyAnimeName } from "@/features/anime-collection/utils/slugify-anime-name";

/** Folder/file key for bundled anime series assets. */
export type AnimeSeriesAssetKey =
  | "yu-gi-oh"
  | "yu-gi-oh-gx"
  | "yu-gi-oh-5ds"
  | "yu-gi-oh-zexal"
  | "yu-gi-oh-arc-v"
  | "yu-gi-oh-vrains";

const SPINOFF_MATCHERS: { key: AnimeSeriesAssetKey; test: (value: string) => boolean }[] = [
  { key: "yu-gi-oh-vrains", test: (v) => v.includes("vrains") },
  { key: "yu-gi-oh-arc-v", test: (v) => v.includes("arc-v") || v.includes("arcv") },
  { key: "yu-gi-oh-zexal", test: (v) => v.includes("zexal") },
  { key: "yu-gi-oh-5ds", test: (v) => v.includes("5d") },
  { key: "yu-gi-oh-gx", test: (v) => v.includes("gx") },
];

export function resolveAnimeSeriesAssetKey(
  seriesSlug: string,
  seriesName?: string
): AnimeSeriesAssetKey | null {
  // Name first: slug can stay stale after rename (e.g. "yu-gi-oh" + "Yu-Gi-Oh! Arc-V").
  const candidates = [
    seriesName ? slugifyAnimeName(seriesName) : "",
    seriesSlug.trim().toLowerCase(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    for (const { key, test } of SPINOFF_MATCHERS) {
      if (test(candidate)) return key;
    }
  }

  for (const candidate of candidates) {
    if (candidate === "yu-gi-oh" || candidate === "yugioh") {
      return "yu-gi-oh";
    }
  }

  return null;
}
