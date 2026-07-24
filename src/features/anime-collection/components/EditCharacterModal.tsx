"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { AnimeImage } from "@/features/anime-collection/components/AnimeImage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getCharacterInitials } from "@/features/anime-collection/types";
import {
  isValidImageUrl,
  readImageFileAsDataUrl,
} from "@/features/anime-collection/utils/image";
import {
  isWideCharacterPortrait,
  resolveCharacterPortraitUrl,
} from "@/features/anime-collection/utils/resolve-character-portrait";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EditCharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  currentImageUrl: string | null;
  seriesSlug?: string;
  seriesName?: string;
  accentColor: string | null;
  onSave: (input: { name: string; imageUrl: string | null }) => void;
}

export function EditCharacterModal({
  open,
  onOpenChange,
  characterName,
  currentImageUrl,
  seriesSlug,
  seriesName,
  accentColor,
  onSave,
}: EditCharacterModalProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(characterName);
  const [imageUrl, setImageUrl] = useState(currentImageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [loadingFile, setLoadingFile] = useState(false);

  const displayPreview =
    previewUrl?.trim() ||
    resolveCharacterPortraitUrl(seriesSlug, seriesName, name, currentImageUrl);
  const wide = isWideCharacterPortrait(displayPreview);
  const initials = getCharacterInitials(name);

  const resetForm = () => {
    setName(characterName);
    setImageUrl(currentImageUrl ?? "");
    setPreviewUrl(currentImageUrl);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) resetForm();
    onOpenChange(next);
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setLoadingFile(true);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setPreviewUrl(dataUrl);
      setImageUrl(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("anime.photoLoadFailed"));
    } finally {
      setLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const trimmedUrl = imageUrl.trim();
    if (trimmedUrl && !isValidImageUrl(trimmedUrl)) {
      toast.error(t("anime.coverInvalid"));
      return;
    }

    onSave({
      name: trimmedName,
      imageUrl: trimmedUrl || null,
    });
    onOpenChange(false);
    toast.success(t("anime.characterUpdated"));
  };

  const handleRemovePhoto = () => {
    setImageUrl("");
    setPreviewUrl(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t("anime.editCharacterTitle")}
      description={t("anime.editCharacterDescription")}
      footer={
        <>
          {displayPreview && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={handleRemovePhoto}
            >
              {t("anime.removePhoto")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={loadingFile || !name.trim()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5 py-2">
        <div className="space-y-2">
          <Label htmlFor="edit-char-name">{t("common.name")}</Label>
          <Input
            id="edit-char-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-center">
          <div
            className={cn(
              "relative overflow-hidden border-4 border-border/80",
              wide ? "h-28 w-48 rounded-2xl" : "h-28 w-28 rounded-full"
            )}
            style={
              !displayPreview && accentColor
                ? {
                    background: `linear-gradient(135deg, ${accentColor}, hsl(0 0% 16%))`,
                  }
                : undefined
            }
          >
            {displayPreview ? (
              <AnimeImage
                src={displayPreview}
                alt={name}
                fill
                className="object-cover object-center"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white/90">
                {initials}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-char-photo-url">{t("anime.imageUrl")}</Label>
          <Input
            id="edit-char-photo-url"
            value={imageUrl.startsWith("data:") ? "" : imageUrl}
            placeholder={t("common.urlPlaceholder")}
            onChange={(e) => {
              const value = e.target.value;
              setImageUrl(value);
              setPreviewUrl(value.trim() || null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("anime.uploadFromComputer")}</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFileChange(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loadingFile}
            onClick={() => fileInputRef.current?.click()}
          >
            {loadingFile ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {t("anime.chooseImage")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("anime.photoFormatHint")}</p>
        </div>
      </div>
    </Modal>
  );
}
