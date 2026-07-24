"use client";

import { useMemo, useState } from "react";
import { AnimeImage } from "@/features/anime-collection/components/AnimeImage";
import {
  isWideCharacterPortrait,
  resolveCharacterPortraitUrl,
} from "@/features/anime-collection/utils/resolve-character-portrait";
import { getCharacterInitials, type AnimeCharacter } from "@/features/anime-collection/types";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface MoveCardsToCharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characters: AnimeCharacter[];
  seriesSlug: string;
  seriesName: string;
  excludeCharacterId: string;
  selectedCount: number;
  onConfirm: (targetCharacterId: string) => void;
}

export function MoveCardsToCharacterModal({
  open,
  onOpenChange,
  characters,
  seriesSlug,
  seriesName,
  excludeCharacterId,
  selectedCount,
  onConfirm,
}: MoveCardsToCharacterModalProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters
      .filter((c) => c.id !== excludeCharacterId)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [characters, excludeCharacterId, query]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setPickedId(null);
    }
    onOpenChange(next);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t("anime.moveToCharacterTitle")}
      description={t("anime.moveToCharacterDescription")}
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!pickedId}
            onClick={() => {
              if (!pickedId) return;
              onConfirm(pickedId);
              handleOpenChange(false);
            }}
          >
            {t("anime.bulkMoveToCharacter")} ({selectedCount})
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("anime.searchCharacter")}
          autoFocus
        />
        {options.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("anime.noOtherCharacters")}
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-auto">
            {options.map((character) => {
              const portrait = resolveCharacterPortraitUrl(
                seriesSlug,
                seriesName,
                character.name,
                character.imageUrl
              );
              const wide = isWideCharacterPortrait(portrait);
              const picked = pickedId === character.id;
              return (
                <li key={character.id}>
                  <button
                    type="button"
                    onClick={() => setPickedId(character.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                      picked
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "relative shrink-0 overflow-hidden border border-border/60",
                        wide ? "h-10 w-16 rounded-lg" : "h-10 w-10 rounded-full"
                      )}
                      style={
                        !portrait && character.accentColor
                          ? {
                              background: `linear-gradient(135deg, ${character.accentColor}, hsl(0 0% 16%))`,
                            }
                          : undefined
                      }
                    >
                      {portrait ? (
                        <AnimeImage
                          src={portrait}
                          alt={character.name}
                          fill
                          className="object-cover object-center"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/90">
                          {getCharacterInitials(character.name)}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm font-medium">{character.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
