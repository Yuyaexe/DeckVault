"use client";

import { AnimeSeriesPage } from "@/features/anime-collection/components/AnimeSeriesPage";

export default function AnimeCollectionPage() {
  return (
    <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
      <AnimeSeriesPage />
    </div>
  );
}
