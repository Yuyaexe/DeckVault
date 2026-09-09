"use client";

import { use } from "react";
import { AnimeCharacterGridPage } from "@/features/anime-collection/components/AnimeCharacterGridPage";

export default function AnimeSeriesCharactersPage({
  params,
}: {
  params: Promise<{ seriesSlug: string }>;
}) {
  const { seriesSlug } = use(params);

  return (
    <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
      <AnimeCharacterGridPage seriesSlug={seriesSlug} />
    </div>
  );
}
