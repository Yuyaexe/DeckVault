"use client";

import { use } from "react";
import { CharacterDetailPage } from "@/features/anime-collection/components/CharacterDetailPage";

export default function AnimeCharacterDetailPage({
  params,
}: {
  params: Promise<{ seriesSlug: string; characterId: string }>;
}) {
  const { seriesSlug, characterId } = use(params);

  return (
    <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
      <CharacterDetailPage seriesSlug={seriesSlug} characterId={characterId} />
    </div>
  );
}
