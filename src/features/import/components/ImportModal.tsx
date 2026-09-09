"use client";

import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import { FileText, Loader2, Upload } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import {
  autoMapColumns,
  parseCsvRows,
  detectPreset,
  type CsvPreset,
  type CsvColumnMapping,
  CSV_PRESETS,
} from "@/features/import/services/csv-parser";
import {
  aggregateDeckEntries,
  countDecklistCandidateLines,
  inferDecklistGame,
  parseDecklist,
} from "@/features/import/services/decklist-parser";
import type { DecklistGameSlug, ResolvedDeckEntry } from "@/features/import/types";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import { DEMO_GAMES } from "@/lib/demo/types";
import { useAppData } from "@/hooks/useAppData";
import {
  normalizeCardCondition,
  normalizeCardLanguage,
} from "@/features/import/utils/csv-card-fields";
import { NO_ACTIVE_COLLECTION } from "@/lib/data/collection-requirements";
import type { CardCondition, CardLanguage } from "@/types/tcg";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RESOLVE_DECK_MAX_ENTRIES } from "@/lib/api/request-limits";

export interface ImportDeckItem {
  result: CardSearchResult;
  quantity: number;
  gameId: string;
  gameSlug: string;
  gameName: string;
}

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** When set, only the decklist tab is shown (e.g. character deck import). */
  decklistOnly?: boolean;
  /** Custom destination for resolved deck rows (defaults to TCG collection). */
  onImportDeck?: (
    items: ImportDeckItem[],
    mergeDuplicates: boolean
  ) => number | Promise<number>;
}

type ImportTab = "decklist" | "csv";

const RESOLVE_FAILED = "RESOLVE_FAILED";
const RESOLVE_TOO_MANY = "RESOLVE_TOO_MANY";

const FORMAT_KEYS: Record<string, MessageKey> = {
  ydke: "import.formatYdke",
  ydk: "import.formatYdk",
  "yugioh-text": "import.formatYugiohText",
  "digimon-text": "import.formatDigimonText",
  unknown: "import.formatUnknown",
};

async function resolveDeckEntriesChunk(
  entries: ReturnType<typeof aggregateDeckEntries>,
  gameSlug: DecklistGameSlug
): Promise<ResolvedDeckEntry[]> {
  const res = await fetch("/api/cards/resolve-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameSlug, entries }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as {
        maxEntries?: number;
      } | null;
      if (body?.maxEntries != null) throw new Error(RESOLVE_TOO_MANY);
    }
    throw new Error(RESOLVE_FAILED);
  }
  const json = (await res.json()) as { resolved: ResolvedDeckEntry[] };
  return json.resolved;
}

/** Resolve in batches so decks larger than the API cap still import. */
async function resolveDeckEntries(
  entries: ReturnType<typeof aggregateDeckEntries>,
  gameSlug: DecklistGameSlug
): Promise<ResolvedDeckEntry[]> {
  if (entries.length === 0) return [];

  const resolved: ResolvedDeckEntry[] = [];
  for (let i = 0; i < entries.length; i += RESOLVE_DECK_MAX_ENTRIES) {
    const chunk = entries.slice(i, i + RESOLVE_DECK_MAX_ENTRIES);
    const chunkResolved = await resolveDeckEntriesChunk(chunk, gameSlug);
    resolved.push(...chunkResolved);
  }
  return resolved;
}

export function ImportModal({
  open,
  onOpenChange,
  title,
  description,
  decklistOnly = false,
  onImportDeck,
}: ImportModalProps) {
  const t = useT();
  const [tab, setTab] = useState<ImportTab>("decklist");
  const [deckText, setDeckText] = useState("");
  const [gamePreference, setGamePreference] = useState<DecklistGameSlug | "auto">("auto");
  const [mergeDuplicates, setMergeDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [preset, setPreset] = useState<CsvPreset>("generic");
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [fullData, setFullData] = useState<Record<string, string>[]>([]);

  const { importRows, importDeckFromSearch } = useAppData();
  const activeTab = decklistOnly ? "decklist" : tab;

  const gameOptions = useMemo(
    () => [
      { value: "auto" as const, label: t("import.gameAuto") },
      { value: "yugioh" as const, label: "Yu-Gi-Oh!" },
      { value: "digimon" as const, label: "Digimon" },
    ],
    [t]
  );

  const parsedDeck = useMemo(() => {
    if (!deckText.trim()) return null;
    const preferred = gamePreference === "auto" ? undefined : gamePreference;
    const parsed = parseDecklist(deckText, preferred);
    const rawParsedCount = parsed.entries.length;
    const entries = aggregateDeckEntries(parsed.entries);
    const inferredGame = inferDecklistGame(entries, { ...parsed, entries });
    const candidateLines = countDecklistCandidateLines(deckText);
    const unparsedLines = Math.max(0, candidateLines - rawParsedCount);
    return { ...parsed, entries, inferredGame, unparsedLines };
  }, [deckText, gamePreference]);

  const resetState = useCallback(() => {
    setDeckText("");
    setMapping(null);
    setHeaders([]);
    setPreview([]);
    setFullData([]);
    setImporting(false);
  }, []);

  const handleDeckFile = useCallback(async (file: File) => {
    const text = await file.text();
    setDeckText(text.trim());
  }, []);

  const handleCsvFile = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const h = results.meta.fields ?? [];
        setHeaders(h);
        setFullData(results.data);
        setPreview(results.data.slice(0, 5));
        const detected = autoMapColumns(h);
        setMapping(detected);
        setPreset(detectPreset(h));
      },
    });
  }, []);

  const applyPreset = (p: CsvPreset) => {
    setPreset(p);
    const base = autoMapColumns(headers);
    setMapping({ ...base, ...CSV_PRESETS[p] });
  };

  const formatLabel = (format: string) => {
    const key = FORMAT_KEYS[format];
    return key ? t(key) : format;
  };

  const resolvedGameLabel = (parsed: NonNullable<typeof parsedDeck>) => {
    const slug =
      gamePreference !== "auto"
        ? gamePreference
        : parsed.inferredGame === "unknown"
          ? "yugioh"
          : parsed.inferredGame;
    return gameOptions.find((o) => o.value === slug)?.label ?? "Yu-Gi-Oh!";
  };

  const handleDeckImport = async () => {
    if (!parsedDeck || parsedDeck.entries.length === 0) {
      toast.error(t("import.noCardsInList"));
      return;
    }

    const gameSlug =
      gamePreference !== "auto"
        ? gamePreference
        : parsedDeck.inferredGame === "unknown"
          ? "yugioh"
          : parsedDeck.inferredGame;
    const game =
      DEMO_GAMES.find((g) => g.slug === gameSlug) ??
      DEMO_GAMES.find((g) => g.slug === "yugioh")!;

    setImporting(true);
    setImportStatus(t("import.resolvingCatalog"));
    try {
      const resolved = await resolveDeckEntries(parsedDeck.entries, gameSlug);
      const withResults = resolved.filter((row) => row.result);
      const failed = resolved.length - withResults.length;

      if (withResults.length === 0) {
        toast.error(t("import.noCardsRecognized"));
        return;
      }

      setImportStatus(t("import.savingCollection"));
      const items: ImportDeckItem[] = withResults.map((row) => ({
        result: row.result!,
        quantity: row.entry.quantity,
        gameId: game.id,
        gameSlug: game.slug,
        gameName: game.name,
      }));
      const count = onImportDeck
        ? await onImportDeck(items, mergeDuplicates)
        : await importDeckFromSearch(items, mergeDuplicates);

      toast.success(
        failed > 0
          ? t("import.importSuccessPartial", { count, failed })
          : t("import.importSuccess", { count })
      );
      onOpenChange(false);
      resetState();
    } catch (err) {
      if (err instanceof Error && err.message === RESOLVE_TOO_MANY) {
        toast.error(t("import.resolveTooMany", { max: RESOLVE_DECK_MAX_ENTRIES }));
      } else if (err instanceof Error && err.message === RESOLVE_FAILED) {
        toast.error(t("import.resolveFailed"));
      } else if (err instanceof Error && err.message === NO_ACTIVE_COLLECTION) {
        toast.error(t("collection.noActiveCollection"));
      } else {
        toast.error(err instanceof Error && err.message ? err.message : t("import.failed"));
      }
    } finally {
      setImporting(false);
      setImportStatus(null);
    }
  };

  const handleCsvImport = async () => {
    if (!mapping) return;
    setImporting(true);
    setImportStatus(t("import.importingCsv"));
    try {
      const parsed = parseCsvRows(fullData, mapping);
      const rows = parsed.map((row) => {
        const game =
          DEMO_GAMES.find((g) => g.slug === row.game || g.name.toLowerCase().includes(row.game)) ??
          DEMO_GAMES[0];
        return {
          name: row.name,
          set: row.set,
          quantity: row.quantity,
          condition: normalizeCardCondition(row.condition) as CardCondition,
          language: normalizeCardLanguage(row.language) as CardLanguage,
          gameId: game.id,
          gameSlug: game.slug,
          gameName: game.name,
          isFoil: row.isFoil,
          purchasePrice: row.purchasePrice,
        };
      });
      const count = await importRows(rows, mergeDuplicates);
      toast.success(t("import.csvSuccess", { count }));
      onOpenChange(false);
      resetState();
    } catch (err) {
      if (err instanceof Error && err.message === NO_ACTIVE_COLLECTION) {
        toast.error(t("collection.noActiveCollection"));
      } else {
        toast.error(err instanceof Error ? err.message : t("import.csvFailed"));
      }
    } finally {
      setImporting(false);
      setImportStatus(null);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && importing) return;
        if (!next) resetState();
        onOpenChange(next);
      }}
      title={title ?? t("import.title")}
      description={description ?? t("import.description")}
      className="max-w-2xl sm:max-w-2xl"
    >
      <div className="relative space-y-4">
        <LoadingOverlay
          active={importing}
          title={importStatus ?? t("import.importing")}
          description={t("import.importingHint")}
        />
        {!decklistOnly && (
          <div className="inline-flex shrink-0 rounded-lg border border-border/60 bg-muted/30 p-0.5">
            {(["decklist", "csv"] as ImportTab[]).map((value) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-8 px-3 text-xs", tab === value && "bg-background shadow-sm")}
                onClick={() => setTab(value)}
              >
                {value === "decklist" ? t("import.tabDecklist") : t("import.tabCsv")}
              </Button>
            ))}
          </div>
        )}

        {activeTab === "decklist" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("import.game")}</Label>
                <ResponsiveSelect
                  preferNative
                  value={gamePreference}
                  onValueChange={(v) => setGamePreference(v as DecklistGameSlug | "auto")}
                  options={gameOptions.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-muted/30">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  {t("import.uploadFile")}
                  <input
                    type="file"
                    accept=".txt,.ydk,.ydke,text/plain"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && void handleDeckFile(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("import.decklist")}</Label>
              <textarea
                value={deckText}
                onChange={(e) => setDeckText(e.target.value)}
                placeholder={t("import.decklistPlaceholder")}
                className={cn(
                  "flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-base shadow-sm transition-all duration-150 sm:text-xs",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              />
            </div>

            {parsedDeck && parsedDeck.entries.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2 font-medium">
                  <FileText className="h-4 w-4" />
                  {t("import.previewSummary", {
                    cards: parsedDeck.entries.reduce((sum, entry) => sum + entry.quantity, 0),
                    prints: parsedDeck.entries.length,
                    format: formatLabel(parsedDeck.format),
                  })}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {resolvedGameLabel(parsedDeck)}
                  </span>
                </div>
                {parsedDeck.entries.slice(0, 5).map((entry, index) => (
                  <p key={index} className="truncate text-xs text-muted-foreground">
                    {entry.quantity}× {entry.name}
                    {entry.setCode ? ` · ${entry.setCode}` : ""}
                  </p>
                ))}
                {parsedDeck.entries.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    {t("import.morePrints", { count: parsedDeck.entries.length - 5 })}
                  </p>
                )}
                {parsedDeck.unparsedLines > 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {t("import.unparsedLines", { count: parsedDeck.unparsedLines })}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="merge-deck"
                checked={mergeDuplicates}
                onCheckedChange={(c) => setMergeDuplicates(!!c)}
              />
              <Label htmlFor="merge-deck">{t("import.mergeDuplicates")}</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => void handleDeckImport()}
                disabled={importing || !parsedDeck?.entries.length}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("import.importingBtn")}
                  </>
                ) : (
                  t("import.import")
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {!mapping ? (
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 transition-all duration-150 hover:border-primary/50 hover:bg-muted/30">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">{t("import.csvUpload")}</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
                />
              </label>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("import.preset")}</Label>
                  <ResponsiveSelect
                    preferNative
                    value={preset}
                    onValueChange={(v) => applyPreset(v as CsvPreset)}
                    options={[
                      { value: "generic", label: t("import.presetGeneric") },
                      { value: "cardtrader", label: t("import.presetCardtrader") },
                      { value: "tcgplayer", label: t("import.presetTcgplayer") },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="merge-csv"
                    checked={mergeDuplicates}
                    onCheckedChange={(c) => setMergeDuplicates(!!c)}
                  />
                  <Label htmlFor="merge-csv">{t("import.mergeDuplicates")}</Label>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-sm font-medium">
                    {t("import.previewRows", { count: preview.length })}
                  </p>
                  {preview.slice(0, 3).map((row, i) => (
                    <p key={i} className="truncate text-xs text-muted-foreground">
                      {row[mapping.name]}
                    </p>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMapping(null)}>
                    {t("import.back")}
                  </Button>
                  <Button
                    onClick={() => void handleCsvImport()}
                    disabled={importing || fullData.length === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("import.importingBtn")}
                      </>
                    ) : (
                      t("import.importCsv")
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
