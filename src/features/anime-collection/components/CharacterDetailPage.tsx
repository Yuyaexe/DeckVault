"use client";

import { useRouter } from "next/navigation";
import { Download, Layers, PackageOpen, Pencil, Plus, Upload } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Modal } from "@/components/shared/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { CharacterCardsView } from "@/features/anime-collection/components/CharacterCardsView";
import { AnimeCharacterBulkActionsBar } from "@/features/anime-collection/components/AnimeCharacterBulkActionsBar";
import { AnimeCollectionBreadcrumb } from "@/features/anime-collection/components/AnimeCollectionBreadcrumb";
import { CharacterWheel } from "@/features/anime-collection/components/CharacterWheel";
import {
  CharacterAvatar,
  EditCharacterPhotoModal,
} from "@/features/anime-collection/components/EditCharacterPhotoModal";
import { QuickAddModal } from "@/features/collection/components/QuickAddModal";
import { ExportDeckModal } from "@/features/import/components/ExportDeckModal";
import { ImportModal } from "@/features/import/components/ImportModal";
import { CardInspectDialog } from "@/components/shared/CardInspectDialog";
import { useAnimeCollection } from "@/features/anime-collection/hooks/useAnimeCollection";
import { useAnimeCharacterUIStore } from "@/features/anime-collection/stores/anime-character-ui.store";
import { useAnimeShareSyncStore } from "@/features/anime-collection/stores/anime-share-sync.store";
import {
  animeCharacterCardToOwned,
  ownedUpdatesToAnimeCharacter,
} from "@/features/anime-collection/utils/character-card-inspect";
import { AnimeYugiohPasscodeSync } from "@/features/anime-collection/hooks/useAnimeYugiohPasscodeSync";
import { YugiohPasscodeProvider } from "@/features/collection/context/yugioh-passcode-context";
import {
  binderSpreadCount,
  mergeBinderLayout,
} from "@/lib/collections/binder-layout";
import { BINDER_GRID_LAYOUTS } from "@/components/shared/binder/BinderChrome";
import { useAppData } from "@/hooks/useAppData";
import { useDemoStore } from "@/lib/demo/store";
import { useT } from "@/lib/i18n/context";
import {
  cardMatchesDeckCategoryFilter,
  type YugiohDeckCategory,
  YUGIOH_DECK_CATEGORIES,
} from "@/lib/yugioh/deck-category";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface CharacterDetailPageProps {
  seriesSlug: string;
  characterId: string;
}

export function CharacterDetailPage({
  seriesSlug,
  characterId,
}: CharacterDetailPageProps) {
  const t = useT();
  const router = useRouter();
  const { profile } = useAppData();
  const {
    getSeriesBySlug,
    getCharacterById,
    getCharactersForSeries,
    renameAnimeCharacter,
    updateAnimeCharacterImage,
    deleteAnimeCharacter,
    addAnimeCharacterCardFromSearch,
    removeAnimeCharacterCard,
    updateAnimeCharacterCardQuantity,
    setAnimeCharacterCardsQuantityToOne,
    sortAnimeCharacterCards,
    updateAnimeCharacterCard,
    reorderAnimeCharacterCard,
    moveAnimeCharacterCardsToBinderSlot,
    moveAnimeCharacterCardsToBinderSpread,
    transferAnimeCharacterCards,
    animeBinderLayoutByCharacter,
  } = useAnimeCollection();

  const clearSelection = useAnimeCharacterUIStore((s) => s.clearSelection);
  const draggedCardIds = useAnimeCharacterUIStore((s) => s.draggedCardIds);
  const setDraggedCardIds = useAnimeCharacterUIStore((s) => s.setDraggedCardIds);
  const triggerPriorityPush = useAnimeShareSyncStore((s) => s.triggerPriorityPush);
  const isShared = useAnimeShareSyncStore((s) => s.isShared);

  const series = getSeriesBySlug(seriesSlug);
  const character = getCharacterById(characterId);
  const seriesCharacters = useMemo(
    () => (series ? getCharactersForSeries(series.id) : []),
    [getCharactersForSeries, series]
  );
  const animeCharacterCards = useDemoStore((s) => s.animeCharacterCards);
  const characterCards = useMemo(
    () =>
      character
        ? animeCharacterCards
            .filter((c) => c.characterId === character.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [character, animeCharacterCards]
  );

  const [deckFilters, setDeckFilters] = useState<Set<YugiohDeckCategory>>(
    () => new Set()
  );

  const typedCardCount = useMemo(
    () => characterCards.filter((card) => !!card.card.type?.trim()).length,
    [characterCards]
  );
  const typesPending = characterCards.length > 0 && typedCardCount < characterCards.length;

  const visibleCards = useMemo(() => {
    if (deckFilters.size === 0) return characterCards;
    return characterCards.filter((card) =>
      cardMatchesDeckCategoryFilter(card.card.type, deckFilters, {
        includeUnknown: typesPending,
      })
    );
  }, [characterCards, deckFilters, typesPending]);

  const displayBinderLayout = useMemo(() => {
    if (deckFilters.size > 0) {
      // Compact filtered view — avoid empty pockets from the full binder.
      return visibleCards.map((card) => card.id);
    }
    return animeBinderLayoutByCharacter[characterId] ?? [];
  }, [animeBinderLayoutByCharacter, characterId, deckFilters.size, visibleCards]);

  const toggleDeckFilter = useCallback((category: YugiohDeckCategory) => {
    setDeckFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const ownedForPasscodes = useMemo(
    () => characterCards.map(animeCharacterCardToOwned),
    [characterCards]
  );

  const cardQuantitiesById = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of characterCards) {
      map.set(card.id, card.quantity);
    }
    return map;
  }, [characterCards]);

  const [binderLayoutId, setBinderLayoutId] = useState<"4x3" | "3x3">("4x3");
  useEffect(() => {
    const stored = localStorage.getItem("deckvault-anime-character-binder-layout");
    if (stored === "3x3" || stored === "4x3") setBinderLayoutId(stored);
  }, []);
  const { cols, rows } = BINDER_GRID_LAYOUTS[binderLayoutId];
  const spreadSize = cols * rows * 2;

  const totalSpreads = useMemo(() => {
    const ids = characterCards.map((c) => c.id);
    const saved = animeBinderLayoutByCharacter[characterId] ?? ids;
    const layout = mergeBinderLayout(saved, ids);
    return binderSpreadCount(layout, spreadSize);
  }, [animeBinderLayoutByCharacter, characterCards, characterId, spreadSize]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [setAllToOneOpen, setSetAllToOneOpen] = useState(false);
  const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null);
  const [inspectCardId, setInspectCardId] = useState<string | null>(null);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [sortValue, setSortValue] = useState("name:asc");
  const lastDeckSortTypedCount = useRef(0);

  const hasQuantityAboveOne = useMemo(
    () => characterCards.some((card) => card.quantity > 1),
    [characterCards]
  );

  const handleSortChange = useCallback(
    (value: string) => {
      if (!character) return;
      const [field, dir] = value.split(":") as [
        "name" | "quantity" | "set" | "rarity" | "deck",
        "asc" | "desc",
      ];
      setSortValue(value);
      sortAnimeCharacterCards(character.id, field, dir);
      if (field === "deck") {
        lastDeckSortTypedCount.current = typedCardCount;
      }
    },
    [character, sortAnimeCharacterCards, typedCardCount]
  );

  // Re-apply deck sort once card types finish loading.
  useEffect(() => {
    if (!character || sortValue !== "deck:asc") return;
    if (typedCardCount === 0) return;
    if (typedCardCount <= lastDeckSortTypedCount.current) return;
    lastDeckSortTypedCount.current = typedCardCount;
    sortAnimeCharacterCards(character.id, "deck", "asc");
  }, [character, sortAnimeCharacterCards, sortValue, typedCardCount]);

  const handleSetAllToOne = useCallback(() => {
    if (!character || !hasQuantityAboveOne) return;
    setSetAllToOneOpen(true);
  }, [character, hasQuantityAboveOne]);

  const confirmSetAllToOne = useCallback(() => {
    if (!character) return;
    const changed = setAnimeCharacterCardsQuantityToOne(character.id);
    setSetAllToOneOpen(false);
    if (changed > 0) {
      toast.success(t("anime.setAllToOneDone", { count: changed }));
      if (isShared) triggerPriorityPush();
    } else {
      toast.message(t("anime.setAllToOneNone"));
    }
  }, [character, isShared, setAnimeCharacterCardsQuantityToOne, t, triggerPriorityPush]);

  useEffect(() => {
    clearSelection();
    setDraggedCardIds([]);
    setSpreadIndex(0);
    setSortValue("name:asc");
    setDeckFilters(new Set());
    lastDeckSortTypedCount.current = 0;
  }, [characterId, clearSelection, setDraggedCardIds]);

  useEffect(() => {
    return () => {
      clearSelection();
      setDraggedCardIds([]);
    };
  }, [clearSelection, setDraggedCardIds]);

  const handleImportDeck = useCallback(
    (
      items: Array<{
        result: Parameters<typeof addAnimeCharacterCardFromSearch>[1];
        quantity: number;
        gameId: string;
        gameSlug: string;
        gameName: string;
      }>
    ) => {
      if (!character) return 0;
      let count = 0;
      for (const item of items) {
        addAnimeCharacterCardFromSearch(
          character.id,
          item.result,
          item.gameId,
          item.gameSlug,
          item.gameName,
          item.quantity
        );
        count += item.quantity;
      }
      return count;
    },
    [addAnimeCharacterCardFromSearch, character]
  );

  const exportCards = useMemo(
    () => characterCards.map(animeCharacterCardToOwned),
    [characterCards]
  );

  const inspectEntry = useMemo(
    () => characterCards.find((c) => c.id === inspectCardId) ?? null,
    [characterCards, inspectCardId]
  );

  const handleDropOnCharacter = useCallback(
    (targetCharacterId: string, cardIds: string[]) => {
      if (!character || targetCharacterId === character.id) return;
      const target = seriesCharacters.find((c) => c.id === targetCharacterId);
      const result = transferAnimeCharacterCards(
        character.id,
        targetCharacterId,
        cardIds
      );
      setDraggedCardIds([]);
      clearSelection();
      if (result.moved > 0 && result.merged > 0) {
        toast.success(
          t("anime.cardsMovedMerged", {
            moved: result.moved,
            merged: result.merged,
            name: target?.name ?? "",
          })
        );
      } else if (result.merged > 0) {
        toast.success(t("anime.cardsMerged", { count: result.merged }));
      } else if (result.moved > 0) {
        toast.success(
          t("anime.cardsMoved", {
            count: result.moved,
            name: target?.name ?? "",
          })
        );
      }
    },
    [
      character,
      clearSelection,
      seriesCharacters,
      setDraggedCardIds,
      t,
      transferAnimeCharacterCards,
    ]
  );

  if (!series || !character || character.seriesId !== series.id) {
    return (
      <EmptyState
        icon={PackageOpen}
        title={t("anime.characterNotFoundTitle")}
        description={t("anime.characterNotFoundDescription")}
        actionLabel={t("anime.backToSeries")}
        onAction={() => router.push(`/anime-collection/${seriesSlug}`)}
        className="mt-12"
      />
    );
  }

  const handleRename = () => {
    const trimmed = renameName.trim();
    if (!trimmed) return;
    renameAnimeCharacter(character.id, trimmed);
    setRenameOpen(false);
    toast.success(t("anime.characterRenamed"));
  };

  const handleDelete = () => {
    if (character.isSeeded) {
      toast.error(t("anime.builtinNoDelete"));
      return;
    }
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    deleteAnimeCharacter(character.id);
    setDeleteOpen(false);
    toast.success(t("anime.characterDeleted"));
    if (isShared) triggerPriorityPush();
    router.push(`/anime-collection/${seriesSlug}`);
  };

  const handleRemoveCard = (cardId: string) => {
    setPendingDeleteCardId(cardId);
  };

  const handleQuantityChange = (cardId: string, quantity: number) => {
    if (quantity < 1) {
      setPendingDeleteCardId(cardId);
      return;
    }
    updateAnimeCharacterCardQuantity(cardId, quantity);
  };

  const pendingDeleteCard = pendingDeleteCardId
    ? characterCards.find((c) => c.id === pendingDeleteCardId) ?? null
    : null;

  const confirmRemoveCard = () => {
    if (!pendingDeleteCardId) return;
    removeAnimeCharacterCard(pendingDeleteCardId);
    toast.success(t("anime.cardRemoved"));
    if (inspectCardId === pendingDeleteCardId) setInspectCardId(null);
    if (isShared) triggerPriorityPush();
    setPendingDeleteCardId(null);
  };

  const removeCardsAndSync = (ids: string[]) => {
    ids.forEach((id) => removeAnimeCharacterCard(id));
    if (ids.length > 0 && isShared) triggerPriorityPush();
  };

  return (
    <YugiohPasscodeProvider cards={ownedForPasscodes}>
      <AnimeYugiohPasscodeSync cards={characterCards} onUpdate={updateAnimeCharacterCard}>
    <>
      <AnimeCollectionBreadcrumb
        items={[
          { label: t("anime.title"), href: "/anime-collection" },
          { label: series.name, href: `/anime-collection/${seriesSlug}` },
          { label: character.name },
        ]}
      />

      <CharacterWheel
        characters={seriesCharacters}
        activeCharacterId={character.id}
        seriesSlug={seriesSlug}
        seriesName={series.name}
        draggedCardIds={draggedCardIds}
        onDropCardsOnCharacter={handleDropOnCharacter}
      />

      <div className="mx-auto flex max-w-lg flex-col items-center pt-4">
        <CharacterAvatar
          name={character.name}
          imageUrl={character.imageUrl}
          seriesSlug={seriesSlug}
          seriesName={series.name}
          accentColor={character.accentColor}
          editable
          onEdit={() => setPhotoOpen(true)}
        />

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {character.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{series.name}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPhotoOpen(true)}>
            Change photo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRenameName(character.name);
              setRenameOpen(true);
            }}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit name
          </Button>
          {!character.isSeeded && (
            <Button variant="outline" size="sm" onClick={handleDelete}>
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("anime.cardsSection")}</h2>
            <p className="text-sm text-muted-foreground">
              {characterCards.length === 0
                ? t("anime.noCardsLinked")
                : deckFilters.size > 0
                  ? t("anime.filteredCardsCount", {
                      shown: visibleCards.length,
                      total: characterCards.length,
                    })
                  : characterCards.length === 1
                    ? `1 ${t("common.cards").replace(/s$/, "")}`
                    : `${characterCards.length} ${t("common.cards")}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {characterCards.length > 0 ? (
              <>
                <div className="w-[min(100%,14rem)]">
                  <ResponsiveSelect
                    value={sortValue}
                    onValueChange={handleSortChange}
                    placeholder={t("collection.sortBy")}
                    triggerClassName="h-9"
                    options={[
                      { value: "deck:asc", label: t("anime.sortDeckSections") },
                      { value: "name:asc", label: t("collection.sortNameAsc") },
                      { value: "name:desc", label: t("collection.sortNameDesc") },
                      { value: "quantity:desc", label: t("collection.sortQtyDesc") },
                      { value: "quantity:asc", label: t("collection.sortQtyAsc") },
                    ]}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleSetAllToOne}
                  disabled={!hasQuantityAboveOne}
                >
                  {t("anime.setAllToOne")}
                </Button>
              </>
            ) : null}
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" />
              {t("anime.importCharacterDeck")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportOpen(true)}
              disabled={characterCards.length === 0}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {t("anime.exportCharacterDeck")}
            </Button>
            <Button onClick={() => setAddCardOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("anime.addCard")}
            </Button>
          </div>
        </div>

        {characterCards.length > 0 ? (
          <div
            className="mb-4 flex flex-wrap items-center gap-2"
            role="group"
            aria-label={t("anime.filterTypeLabel")}
          >
            {YUGIOH_DECK_CATEGORIES.map((category) => {
              const active = deckFilters.has(category);
              const label =
                category === "monster"
                  ? t("anime.filterMonster")
                  : category === "spell"
                    ? t("anime.filterSpell")
                    : category === "trap"
                      ? t("anime.filterTrap")
                      : t("anime.filterExtra");
              return (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  className={cn("h-8", active && "shadow-sm")}
                  onClick={() => toggleDeckFilter(category)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        ) : null}

        {characterCards.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card/50">
            <EmptyState
              icon={Layers}
              title={t("anime.noCardsTitle")}
              description={t("anime.noCardsDescription")}
              actionLabel={t("anime.addCard")}
              onAction={() => setAddCardOpen(true)}
            />
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
            {t("anime.filteredCardsCount", {
              shown: 0,
              total: characterCards.length,
            })}
          </div>
        ) : (
          <CharacterCardsView
            cards={visibleCards}
            binderSlotLayout={displayBinderLayout}
            onRemove={handleRemoveCard}
            onQuantityChange={handleQuantityChange}
            onOpenCard={(item) => setInspectCardId(item.id)}
            onReorder={(draggedId, targetId) => {
              if (deckFilters.size > 0) return;
              reorderAnimeCharacterCard(character.id, draggedId, targetId);
            }}
            onMoveToBinderSlot={(cardIds, targetIndex) => {
              if (deckFilters.size > 0) return;
              moveAnimeCharacterCardsToBinderSlot(character.id, cardIds, targetIndex);
            }}
            onMoveToBinderSpread={(cardIds, targetSpreadIndex, size) => {
              if (deckFilters.size > 0) return;
              moveAnimeCharacterCardsToBinderSpread(
                character.id,
                cardIds,
                targetSpreadIndex,
                size
              );
              setSpreadIndex(targetSpreadIndex);
            }}
            spreadIndex={spreadIndex}
            onSpreadIndexChange={setSpreadIndex}
          />
        )}
      </div>

      <AnimeCharacterBulkActionsBar
        characterId={character.id}
        characterName={character.name}
        seriesSlug={seriesSlug}
        seriesName={series.name}
        seriesCharacters={seriesCharacters}
        totalSpreads={totalSpreads}
        spreadSize={spreadSize}
        binderSlotLayout={animeBinderLayoutByCharacter[character.id] ?? []}
        cardIds={visibleCards.map((c) => c.id)}
        cardQuantitiesById={cardQuantitiesById}
        onMoveToSpread={(cardIds, targetSpread) => {
          moveAnimeCharacterCardsToBinderSpread(
            character.id,
            cardIds,
            targetSpread,
            spreadSize
          );
          setSpreadIndex(targetSpread);
        }}
        onTransferToCharacter={(cardIds, targetId) =>
          transferAnimeCharacterCards(character.id, targetId, cardIds)
        }
        onDelete={(ids) => {
          removeCardsAndSync(ids);
        }}
      />

      <CardInspectDialog
        card={inspectEntry ? animeCharacterCardToOwned(inspectEntry) : null}
        open={!!inspectCardId && !!inspectEntry}
        onOpenChange={(open) => {
          if (!open) setInspectCardId(null);
        }}
        currency={profile.currency}
        onUpdate={(id, updates) => updateAnimeCharacterCard(id, ownedUpdatesToAnimeCharacter(updates))}
        onDelete={(ids) => {
          removeCardsAndSync(ids);
          setInspectCardId(null);
        }}
      />

      <ExportDeckModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        cards={exportCards}
        collectionName={`${character.name}_deck`}
        title={t("anime.exportCharacterDeck")}
        description={t("anime.exportCharacterDeckDescription")}
      />

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t("anime.importCharacterDeckTitle")}
        description={t("anime.importCharacterDeckDescription")}
        decklistOnly
        onImportDeck={handleImportDeck}
      />

      <QuickAddModal
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        title={t("anime.addCard")}
        defaultGameSlug="yugioh"
        closeOnAdd={false}
        onAdd={(result, game) => {
          addAnimeCharacterCardFromSearch(
            character.id,
            result,
            game.id,
            game.slug,
            game.name
          );
        }}
      />

      <EditCharacterPhotoModal
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        characterName={character.name}
        currentImageUrl={character.imageUrl}
        seriesSlug={seriesSlug}
        seriesName={series.name}
        accentColor={character.accentColor}
        onSave={(url) => updateAnimeCharacterImage(character.id, url)}
      />

      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={t("anime.editCharacter")}
        footer={
          <>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-2 py-2">
          <Label htmlFor="rename-char">{t("common.name")}</Label>
          <Input
            id="rename-char"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("anime.deleteCharacterTitle")}
        description={t("anime.deleteCharacterConfirmBody", { name: character.name })}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <span className="sr-only">{t("anime.confirmDeleteCharacter")}</span>
      </Modal>

      <Modal
        open={setAllToOneOpen}
        onOpenChange={setSetAllToOneOpen}
        title={t("anime.setAllToOneTitle")}
        description={t("anime.setAllToOneConfirm")}
        footer={
          <>
            <Button variant="outline" onClick={() => setSetAllToOneOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmSetAllToOne}>{t("common.confirm")}</Button>
          </>
        }
      >
        <span className="sr-only">{t("anime.setAllToOneConfirm")}</span>
      </Modal>

      <Modal
        open={pendingDeleteCardId != null && pendingDeleteCard != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteCardId(null);
        }}
        title={t("anime.deleteCardTitle")}
        description={t("anime.deleteCardDescription", {
          name: pendingDeleteCard?.card.name ?? "",
        })}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDeleteCardId(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmRemoveCard}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <span className="sr-only">{t("anime.deleteCardTitle")}</span>
      </Modal>
    </>
      </AnimeYugiohPasscodeSync>
    </YugiohPasscodeProvider>
  );
}
