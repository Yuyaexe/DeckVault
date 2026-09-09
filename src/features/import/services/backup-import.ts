import {
  BACKUP_VERSION,
  isAnimeCollectionBackup,
  resolveAnimeBackupFields,
  type AnimeCollectionBackup,
  type DeckVaultBackup,
} from "@/features/import/services/backup-export";
import {
  convertCtTabExportToDeckVault,
  convertExternalWishlistToDeckVault,
  isCtYugiohTabExport,
  isExternalWishlistBackup,
  mergeDeckVaultCollectionsByTab,
} from "@/features/import/services/external-wishlist-converter";
import {
  RestoreStepError,
  type RestoreFailureResponse,
} from "@/features/import/services/restore-debug";

export type ParsedBackupFile =
  | { scope: "full"; backup: DeckVaultBackup }
  | { scope: "anime"; backup: AnimeCollectionBackup };

export function parseBackupJson(raw: unknown): DeckVaultBackup {
  if (!raw || typeof raw !== "object") {
    throw new RestoreStepError("parse_json", new Error("Arquivo JSON inválido"));
  }

  try {
    if (isExternalWishlistBackup(raw)) {
      return convertExternalWishlistToDeckVault(raw);
    }

    if (isCtYugiohTabExport(raw)) {
      return convertCtTabExportToDeckVault(raw);
    }

    const backup = raw as DeckVaultBackup;
    const obj = raw as Record<string, unknown>;

    if (backup.version !== BACKUP_VERSION) {
      if (obj.backupVersion != null || obj.exportVersion != null) {
        throw new Error(
          "Arquivo do app CT (Tools/CT) reconhecido, mas a conversão falhou. Verifique o formato do JSON."
        );
      }
      throw new Error(`Versão de backup não suportada: ${String(backup.version)}`);
    }
    if (
      !backup.profile ||
      !Array.isArray(backup.collections) ||
      !Array.isArray(backup.ownedCards)
    ) {
      throw new Error("Estrutura de backup incompleta");
    }

    const normalized: DeckVaultBackup = {
      version: BACKUP_VERSION,
      exportedAt: backup.exportedAt ?? new Date().toISOString(),
      profile: backup.profile,
      collections: backup.collections,
      ownedCards: backup.ownedCards,
      tags: backup.tags ?? [],
      ...resolveAnimeBackupFields(backup),
    };

    return mergeDeckVaultCollectionsByTab(normalized);
  } catch (cause) {
    if (cause instanceof RestoreStepError) throw cause;
    throw new RestoreStepError("parse_json", cause);
  }
}

export async function readBackupFile(file: File): Promise<ParsedBackupFile> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Arquivo não é um JSON válido");
  }

  if (isAnimeCollectionBackup(parsed)) {
    return {
      scope: "anime",
      backup: {
        ...parsed,
        ...resolveAnimeBackupFields(parsed),
      },
    };
  }

  return { scope: "full", backup: parseBackupJson(parsed) };
}

export function defaultCollectionAfterRestore(backup: DeckVaultBackup): string | null {
  const col = backup.collections.find((c) => c.isDefault) ?? backup.collections[0];
  return col?.id ?? null;
}

export async function restoreBackupOnServer(backup: DeckVaultBackup) {
  const res = await fetch("/api/app/backup/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backup }),
  });

  let json: RestoreFailureResponse & {
    importedCards?: number;
    collections?: number;
  };
  try {
    json = await res.json();
  } catch {
    throw new RestoreStepError(
      "api_request",
      new Error(`Resposta inválida do servidor (HTTP ${res.status})`)
    );
  }

  if (!res.ok) {
    throw new RestoreStepError(
      json.stage ?? "api_request",
      json.detail ?? json.error ?? `HTTP ${res.status}`
    );
  }

  return json as { importedCards: number; collections: number };
}
