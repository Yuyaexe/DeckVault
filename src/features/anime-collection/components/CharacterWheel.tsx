"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnimeCharacter } from "@/features/anime-collection/types";
import { CharacterBubble } from "@/features/anime-collection/components/CharacterBubble";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface CharacterWheelProps {
  characters: AnimeCharacter[];
  activeCharacterId: string;
  seriesSlug: string;
  seriesName: string;
  /** Card ids currently being dragged (empty when not dragging). */
  draggedCardIds?: string[];
  onDropCardsOnCharacter?: (targetCharacterId: string, cardIds: string[]) => void;
}

export function CharacterWheel({
  characters,
  activeCharacterId,
  seriesSlug,
  seriesName,
  draggedCardIds = [],
  onDropCardsOnCharacter,
}: CharacterWheelProps) {
  const t = useT();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);

  const isDragging = draggedCardIds.length > 0;

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeCharacterId]);

  useEffect(() => {
    if (!isDragging) setHoverTargetId(null);
  }, [isDragging]);

  if (characters.length <= 1) return null;

  return (
    <div
      ref={scrollRef}
      role="list"
      aria-label={t("anime.switchCharacter")}
      className="mx-auto mb-6 w-full max-w-5xl overflow-x-auto px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]"
    >
      <div className="flex min-w-min items-end justify-center gap-4 px-2">
        {characters.map((character, index) => {
          const selected = character.id === activeCharacterId;
          const canDrop =
            isDragging &&
            character.id !== activeCharacterId &&
            !!onDropCardsOnCharacter;
          const dropHover = canDrop && hoverTargetId === character.id;

          return (
            <div
              key={character.id}
              ref={selected ? activeRef : undefined}
              role="listitem"
              className={cn(
                "shrink-0 rounded-full transition-all",
                dropHover && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
              )}
              onDragOver={
                canDrop
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setHoverTargetId(character.id);
                    }
                  : undefined
              }
              onDragLeave={
                canDrop
                  ? () => {
                      setHoverTargetId((id) => (id === character.id ? null : id));
                    }
                  : undefined
              }
              onDrop={
                canDrop
                  ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHoverTargetId(null);
                      onDropCardsOnCharacter?.(character.id, draggedCardIds);
                    }
                  : undefined
              }
            >
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div>
                    <CharacterBubble
                      name={character.name}
                      imageUrl={character.imageUrl}
                      seriesSlug={seriesSlug}
                      seriesName={seriesName}
                      accentColor={character.accentColor}
                      variant="wheel"
                      selected={selected || dropHover}
                      showName={false}
                      index={index}
                      onClick={() => {
                        if (isDragging) return;
                        router.push(
                          `/anime-collection/${seriesSlug}/${character.id}`
                        );
                      }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {canDrop
                    ? t("anime.dropOnCharacter", { count: draggedCardIds.length })
                    : character.name}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
