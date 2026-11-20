"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const rowRef = useRef<HTMLDivElement>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);

  const isDragging = draggedCardIds.length > 0;

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    let allowAutoCenter = true;
    let ignoreProgrammaticScroll = false;
    let scrollFrame = 0;
    let stabilizationFrame = 0;
    let releaseProgrammaticScrollFrame = 0;

    const updateEdgePadding = () => {
      const row = rowRef.current;
      if (!row) return;
      const items = row.querySelectorAll<HTMLElement>('[role="listitem"]');
      const first = items.item(0);
      const last = items.item(items.length - 1);
      if (!first || !last) return;

      row.style.paddingLeft = `${Math.max(0, scroller.clientWidth / 2 - first.offsetWidth / 2)}px`;
      row.style.paddingRight = `${Math.max(0, scroller.clientWidth / 2 - last.offsetWidth / 2)}px`;
    };

    const centerActive = () => {
      if (!allowAutoCenter) return;
      const active = scroller
        .querySelector<HTMLElement>('[aria-current="true"]')
        ?.closest<HTMLElement>('[role="listitem"]');
      if (!active) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const activeCenterInContent =
        scroller.scrollLeft +
        (activeRect.left - scrollerRect.left) +
        activeRect.width / 2;
      const left = activeCenterInContent - scroller.clientWidth / 2;
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const nextLeft = Math.min(maxScrollLeft, Math.max(0, left));

      if (Math.abs(scroller.scrollLeft - nextLeft) < 0.5) return;

      ignoreProgrammaticScroll = true;
      scroller.scrollTo({
        left: nextLeft,
        behavior: "auto",
      });
      cancelAnimationFrame(releaseProgrammaticScrollFrame);
      releaseProgrammaticScrollFrame = requestAnimationFrame(() => {
        ignoreProgrammaticScroll = false;
      });
    };

    const stopAutoCenter = () => {
      allowAutoCenter = false;
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(stabilizationFrame);
    };

    const handleScroll = () => {
      if (!allowAutoCenter || ignoreProgrammaticScroll) return;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(centerActive);
    };

    const stabilizationStartedAt = performance.now();
    const stabilize = () => {
      if (!allowAutoCenter) return;
      updateEdgePadding();
      centerActive();
      if (performance.now() - stabilizationStartedAt < 1_200) {
        stabilizationFrame = requestAnimationFrame(stabilize);
      }
    };
    updateEdgePadding();
    stabilizationFrame = requestAnimationFrame(stabilize);
    const resizeObserver = new ResizeObserver(() => {
      updateEdgePadding();
      centerActive();
    });
    resizeObserver.observe(scroller);
    const edgeItems = rowRef.current?.querySelectorAll<HTMLElement>('[role="listitem"]');
    const firstItem = edgeItems?.item(0);
    const lastItem = edgeItems?.item((edgeItems?.length ?? 1) - 1);
    if (firstItem) resizeObserver.observe(firstItem);
    if (lastItem && lastItem !== firstItem) resizeObserver.observe(lastItem);

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    scroller.addEventListener("wheel", stopAutoCenter, { passive: true });
    scroller.addEventListener("pointerdown", stopAutoCenter, { passive: true });
    scroller.addEventListener("touchstart", stopAutoCenter, { passive: true });
    scroller.addEventListener("keydown", stopAutoCenter);

    return () => {
      cancelAnimationFrame(releaseProgrammaticScrollFrame);
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(stabilizationFrame);
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", handleScroll);
      scroller.removeEventListener("wheel", stopAutoCenter);
      scroller.removeEventListener("pointerdown", stopAutoCenter);
      scroller.removeEventListener("touchstart", stopAutoCenter);
      scroller.removeEventListener("keydown", stopAutoCenter);
    };
  }, [activeCharacterId, characters.length]);

  useEffect(() => {
    if (!isDragging) setHoverTargetId(null);
  }, [isDragging]);

  if (characters.length <= 1) return null;

  return (
    <div
      ref={scrollRef}
      role="list"
      aria-label={t("anime.switchCharacter")}
      className="character-wheel-scroll mx-auto mb-6 w-full max-w-5xl overflow-x-auto pb-2"
    >
      <div ref={rowRef} className="flex w-max min-w-full items-end justify-start gap-4">
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
                          `/anime-collection/${seriesSlug}/${character.id}`,
                          { scroll: false }
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
