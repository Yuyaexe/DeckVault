"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { CardImage } from "@/components/shared/CardImage";
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

interface EditCharacterPhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  currentImageUrl: string | null;
  seriesSlug?: string;
  seriesName?: string;
  accentColor: string | null;
  onSave: (imageUrl: string | null) => void;
}

export function EditCharacterPhotoModal({
  open,
  onOpenChange,
  characterName,
  currentImageUrl,
  seriesSlug,
  seriesName,
  accentColor,
  onSave,
}: EditCharacterPhotoModalProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(currentImageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [loadingFile, setLoadingFile] = useState(false);

  const initials = getCharacterInitials(characterName);
  const displayPreview =
    previewUrl?.trim() ||
    resolveCharacterPortraitUrl(seriesSlug, seriesName, characterName, currentImageUrl);
  const widePreview = isWideCharacterPortrait(displayPreview);

  const resetForm = () => {
    setImageUrl(currentImageUrl ?? "");
    setPreviewUrl(currentImageUrl);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      resetForm();
    }
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
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      onSave(null);
      onOpenChange(false);
      toast.success(t("anime.photoRemoved"));
      return;
    }
    if (!isValidImageUrl(trimmed)) {
      toast.error(t("anime.coverInvalid"));
      return;
    }
    onSave(trimmed);
    onOpenChange(false);
    toast.success(t("anime.photoUpdated"));
  };

  const handleRemove = () => {
    onSave(null);
    onOpenChange(false);
    toast.success(t("anime.photoRemoved"));
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t("anime.changePhoto")}
      description={t("anime.changePhotoDescription", { name: characterName })}
      footer={
        <>
          {currentImageUrl && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={handleRemove}>
              {t("anime.removePhoto")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={loadingFile}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5 py-2">
        <div className="flex justify-center">
          <div
            className={cn(
              "relative overflow-hidden border-4 border-border/80",
              widePreview ? "h-28 w-48 rounded-2xl" : "h-28 w-28 rounded-full"
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
              <CardImage
                src={displayPreview}
                alt={characterName}
                fill
                sizes={widePreview ? "192px" : "112px"}
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
          <Label htmlFor="char-photo-url">{t("anime.imageUrl")}</Label>
          <Input
            id="char-photo-url"
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

interface CharacterAvatarProps {
  name: string;
  imageUrl: string | null;
  seriesSlug?: string;
  seriesName?: string;
  accentColor: string | null;
  size?: "md" | "lg";
  editable?: boolean;
  onEdit?: () => void;
}

export function CharacterAvatar({
  name,
  imageUrl,
  seriesSlug,
  seriesName,
  accentColor,
  size = "lg",
  editable = false,
  onEdit,
}: CharacterAvatarProps) {
  const t = useT();
  const displayImageUrl = resolveCharacterPortraitUrl(
    seriesSlug,
    seriesName,
    name,
    imageUrl
  );
  const wide = isWideCharacterPortrait(displayImageUrl);
  const initials = getCharacterInitials(name);
  const sizeClass = wide
    ? size === "lg"
      ? "h-40 w-64"
      : "h-[72px] w-[128px]"
    : size === "lg"
      ? "h-40 w-40"
      : "h-[88px] w-[88px]";
  const textClass = size === "lg" ? "text-4xl" : "text-lg";

  const inner = (
    <>
      {displayImageUrl ? (
        <CardImage
          src={displayImageUrl}
          alt={name}
          fill
          sizes={wide ? (size === "lg" ? "256px" : "128px") : size === "lg" ? "160px" : "88px"}
          className="object-cover object-center"
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center font-semibold text-white/90",
            textClass
          )}
        >
          {initials}
        </span>
      )}
      {editable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-8 w-8 text-white" />
        </div>
      )}
    </>
  );

  const className = cn(
    "group relative overflow-hidden border-4 border-border/80 shadow-lg",
    wide ? "rounded-2xl" : "rounded-full",
    sizeClass
  );

  const style =
    !displayImageUrl && accentColor
      ? { background: `linear-gradient(135deg, ${accentColor}, hsl(0 0% 16%))` }
      : undefined;

  if (editable && onEdit) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={cn(className, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background")}
        style={style}
        aria-label={t("anime.changePhotoFor", { name })}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}
