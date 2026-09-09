"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/lib/demo/store";
import type { AnimeCharacter, AnimeSeries } from "@/features/anime-collection/types";
import type { AnimeCharacterCard } from "@/lib/demo/types";

export function useAnimeCollection() {
  const animeSeries = useDemoStore((s) => s.animeSeries);
  const animeCharacters = useDemoStore((s) => s.animeCharacters);
  const animeCharacterCards = useDemoStore((s) => s.animeCharacterCards);
  const addAnimeSeries = useDemoStore((s) => s.addAnimeSeries);
  const renameAnimeSeries = useDemoStore((s) => s.renameAnimeSeries);
  const updateAnimeSeriesCover = useDemoStore((s) => s.updateAnimeSeriesCover);
  const deleteAnimeSeries = useDemoStore((s) => s.deleteAnimeSeries);
  const addAnimeCharacter = useDemoStore((s) => s.addAnimeCharacter);
  const addAnimeCharactersBatch = useDemoStore((s) => s.addAnimeCharactersBatch);
  const renameAnimeCharacter = useDemoStore((s) => s.renameAnimeCharacter);
  const updateAnimeCharacterImage = useDemoStore((s) => s.updateAnimeCharacterImage);
  const deleteAnimeCharacter = useDemoStore((s) => s.deleteAnimeCharacter);
  const addAnimeCharacterCardFromSearch = useDemoStore(
    (s) => s.addAnimeCharacterCardFromSearch
  );
  const removeAnimeCharacterCard = useDemoStore((s) => s.removeAnimeCharacterCard);
  const updateAnimeCharacterCardQuantity = useDemoStore(
    (s) => s.updateAnimeCharacterCardQuantity
  );
  const setAnimeCharacterCardsQuantityToOne = useDemoStore(
    (s) => s.setAnimeCharacterCardsQuantityToOne
  );
  const sortAnimeCharacterCards = useDemoStore((s) => s.sortAnimeCharacterCards);
  const updateAnimeCharacterCardSetName = useDemoStore(
    (s) => s.updateAnimeCharacterCardSetName
  );
  const updateAnimeCharacterCard = useDemoStore((s) => s.updateAnimeCharacterCard);
  const patchAnimeCharacterCardTypes = useDemoStore((s) => s.patchAnimeCharacterCardTypes);
  const reorderAnimeCharacterCard = useDemoStore((s) => s.reorderAnimeCharacterCard);
  const reorderAnimeCharacterCardToIndex = useDemoStore(
    (s) => s.reorderAnimeCharacterCardToIndex
  );
  const moveAnimeCharacterCardToBinderSlot = useDemoStore(
    (s) => s.moveAnimeCharacterCardToBinderSlot
  );
  const moveAnimeCharacterCardsToBinderSlot = useDemoStore(
    (s) => s.moveAnimeCharacterCardsToBinderSlot
  );
  const moveAnimeCharacterCardsToBinderSpread = useDemoStore(
    (s) => s.moveAnimeCharacterCardsToBinderSpread
  );
  const transferAnimeCharacterCards = useDemoStore((s) => s.transferAnimeCharacterCards);
  const animeBinderLayoutByCharacter = useDemoStore((s) => s.animeBinderLayoutByCharacter);

  const sortedSeries = useMemo(
    () => [...animeSeries].sort((a, b) => a.sortOrder - b.sortOrder),
    [animeSeries]
  );

  const characterCountBySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of animeCharacters) {
      map.set(c.seriesId, (map.get(c.seriesId) ?? 0) + 1);
    }
    return map;
  }, [animeCharacters]);

  function getSeriesBySlug(slug: string): AnimeSeries | undefined {
    return animeSeries.find((s) => s.slug === slug);
  }

  function getCharactersForSeries(seriesId: string): AnimeCharacter[] {
    return animeCharacters
      .filter((c) => c.seriesId === seriesId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function getCharacterById(id: string): AnimeCharacter | undefined {
    return animeCharacters.find((c) => c.id === id);
  }

  function getCardsForCharacter(characterId: string): AnimeCharacterCard[] {
    return animeCharacterCards
      .filter((c) => c.characterId === characterId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return {
    animeSeries: sortedSeries,
    animeCharacters,
    animeCharacterCards,
    characterCountBySeries,
    getSeriesBySlug,
    getCharactersForSeries,
    getCharacterById,
    getCardsForCharacter,
    addAnimeSeries,
    renameAnimeSeries,
    updateAnimeSeriesCover,
    deleteAnimeSeries,
    addAnimeCharacter,
    addAnimeCharactersBatch,
    renameAnimeCharacter,
    updateAnimeCharacterImage,
    deleteAnimeCharacter,
    addAnimeCharacterCardFromSearch,
    removeAnimeCharacterCard,
    updateAnimeCharacterCardQuantity,
    setAnimeCharacterCardsQuantityToOne,
    sortAnimeCharacterCards,
    updateAnimeCharacterCardSetName,
    updateAnimeCharacterCard,
    patchAnimeCharacterCardTypes,
    reorderAnimeCharacterCard,
    reorderAnimeCharacterCardToIndex,
    moveAnimeCharacterCardToBinderSlot,
    moveAnimeCharacterCardsToBinderSlot,
    moveAnimeCharacterCardsToBinderSpread,
    transferAnimeCharacterCards,
    animeBinderLayoutByCharacter,
  };
}
