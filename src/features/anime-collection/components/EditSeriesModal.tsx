"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { AnimeImage } from "@/features/anime-collection/components/AnimeImage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  isValidImageUrl,
  readImageFileAsDataUrl,
} from "@/features/anime-collection/utils/image";
import { resolveSeriesCoverUrl } from "@/features/anime-collection/utils/resolve-series-cover";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";

interface EditSeriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesName: string;
  seriesSlug?: string;
  currentCoverUrl: string | null;
  coverColor: string | null;
  onSave: (input: { name: string; coverImageUrl: string | null }) => void;
}

export function EditSeriesModal({
  open,
  onOpenChange,
  seriesName,
  seriesSlug,
  currentCoverUrl,
  coverColor,
  onSave,
}: EditSeriesModalProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(seriesName);
  const [imageUrl, setImageUrl] = useState(currentCoverUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentCoverUrl);
  const [loadingFile, setLoadingFile] = useState(false);

  const displayPreview =
    previewUrl?.trim() ||
    resolveSeriesCoverUrl(seriesSlug ?? "", seriesName, currentCoverUrl);

  const resetForm = () => {
    setName(seriesName);
    setImageUrl(currentCoverUrl ?? "");
    setPreviewUrl(currentCoverUrl);
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
      coverImageUrl: trimmedUrl || null,
    });
    onOpenChange(false);
    toast.success(t("anime.seriesUpdated"));
  };

  const handleRemoveCover = () => {
    setImageUrl("");
    setPreviewUrl(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t("anime.editSeriesTitle")}
      description={t("anime.editSeriesDescription")}
      footer={
        <>
          {displayPreview && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={handleRemoveCover}
            >
              {t("anime.removeCover")}
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
          <Label htmlFor="edit-series-name">{t("anime.seriesName")}</Label>
          <Input
            id="edit-series-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-center">
          <div
            className={cn(
              "relative flex aspect-square h-36 w-36 items-center justify-center overflow-hidden rounded-xl border-4 border-border/80",
              displayPreview && "bg-muted/20"
            )}
            style={
              !displayPreview && coverColor
                ? { background: `linear-gradient(135deg, ${coverColor}, hsl(0 0% 16%))` }
                : undefined
            }
          >
            {displayPreview ? (
              <AnimeImage
                src={displayPreview}
                alt={name}
                className="max-h-full max-w-full object-contain p-2"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/90">
                {name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-series-cover-url">{t("anime.imageUrl")}</Label>
          <Input
            id="edit-series-cover-url"
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
        </div>
      </div>
    </Modal>
  );
}
