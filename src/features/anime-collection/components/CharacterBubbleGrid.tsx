"use client";

import type { AnimeCharacter } from "@/features/anime-collection/types";
import { CharacterBubble } from "@/features/anime-collection/components/CharacterBubble";
import { AddCharacterBubble } from "@/features/anime-collection/components/AnimeSeriesCard";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useT } from "@/lib/i18n/context";

export interface CharacterBubbleGridProps {
  characters: AnimeCharacter[];
  seriesSlug: string;
  seriesName: string;
  onSelect: (character: AnimeCharacter) => void;
  onEdit: (character: AnimeCharacter) => void;
  onDelete: (character: AnimeCharacter) => void;
  onAdd: () => void;
  isTouchDevice?: boolean;
}

export function CharacterBubbleGrid({
  characters,
  seriesSlug,
  seriesName,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  isTouchDevice = false,
}: CharacterBubbleGridProps) {
  const t = useT();

  const renderBubble = (character: AnimeCharacter, index: number) => (
    <CharacterBubble
      name={character.name}
      imageUrl={character.imageUrl}
      seriesSlug={seriesSlug}
      seriesName={seriesName}
      accentColor={character.accentColor}
      index={index}
      onClick={() => onSelect(character)}
    />
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-4">
      {characters.map((character, index) =>
        isTouchDevice ? (
          <div key={character.id}>{renderBubble(character, index)}</div>
        ) : (
          <ContextMenu key={character.id}>
            <ContextMenuTrigger asChild>
              <div>{renderBubble(character, index)}</div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onSelect(character)}>
                {t("common.open")}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onEdit(character)}>
                {t("anime.editCharacter")}
              </ContextMenuItem>
              {!character.isSeeded && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(character)}
                  >
                    {t("common.delete")}
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        )
      )}
      <AddCharacterBubble onClick={onAdd} index={characters.length} />
    </div>
  );
}
