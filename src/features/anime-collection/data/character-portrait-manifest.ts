import type { AnimeSeriesAssetKey } from "@/features/anime-collection/data/anime-series-key";
import { CHARACTER_PORTRAIT_CATALOG } from "@/features/anime-collection/data/character-portraits.catalog";
import { slugifyAnimeName } from "@/features/anime-collection/utils/slugify-anime-name";

export interface CharacterPortraitSeriesConfig {
  basePath: string;
  slugs: readonly string[];
  aliases: Record<string, string>;
}

function buildSeriesConfig(
  seriesKey: AnimeSeriesAssetKey,
  files: Record<string, readonly string[]>
): CharacterPortraitSeriesConfig {
  const slugs = Object.keys(files);
  const aliases: Record<string, string> = {};

  for (const [file, names] of Object.entries(files)) {
    for (const name of names) {
      const key = slugifyAnimeName(name);
      if (key && key !== file) aliases[key] = file;
    }
  }

  return {
    basePath: `/anime-characters/${seriesKey}`,
    slugs,
    aliases,
  };
}

function buildManifest(): Record<
  AnimeSeriesAssetKey,
  CharacterPortraitSeriesConfig | undefined
> {
  const keys: AnimeSeriesAssetKey[] = [
    "yu-gi-oh",
    "yu-gi-oh-gx",
    "yu-gi-oh-5ds",
    "yu-gi-oh-zexal",
    "yu-gi-oh-arc-v",
    "yu-gi-oh-vrains",
  ];

  const manifest = {} as Record<
    AnimeSeriesAssetKey,
    CharacterPortraitSeriesConfig | undefined
  >;

  for (const key of keys) {
    const files = CHARACTER_PORTRAIT_CATALOG[key];
    manifest[key] = files ? buildSeriesConfig(key, files) : undefined;
  }

  return manifest;
}

export const CHARACTER_PORTRAIT_MANIFEST = buildManifest();

export function getCharacterPortraitConfig(
  key: AnimeSeriesAssetKey
): CharacterPortraitSeriesConfig | null {
  return CHARACTER_PORTRAIT_MANIFEST[key] ?? null;
}

export function listCharacterPortraitSeriesKeys(): AnimeSeriesAssetKey[] {
  return (Object.keys(CHARACTER_PORTRAIT_MANIFEST) as AnimeSeriesAssetKey[]).filter(
    (key) => CHARACTER_PORTRAIT_MANIFEST[key] != null
  );
}
