export const RESTORE_STAGES = {
  parse_json: "Ler e converter JSON",
  profile: "Atualizar perfil",
  load_collections: "Carregar coleções existentes",
  create_collections: "Criar ou reutilizar coleções",
  resolve_cards: "Resolver cartas no catálogo",
  aggregate_owned: "Agregar cartas da coleção",
  fetch_owned: "Buscar cartas já salvas",
  insert_owned: "Inserir novas cartas",
  update_quantities: "Atualizar quantidades",
  api_request: "Enviar para o servidor",
} as const;

export type RestoreStage = keyof typeof RESTORE_STAGES;

export type RestoreFailureResponse = {
  error: string;
  stage?: RestoreStage;
  stageLabel?: string;
  detail?: string;
};

export class RestoreStepError extends Error {
  readonly stage: RestoreStage;
  readonly detail: string;

  constructor(stage: RestoreStage, cause: unknown, context?: string) {
    const detail = formatRestoreCause(cause);
    const stageLabel = RESTORE_STAGES[stage];
    const message = context
      ? `${stageLabel}: ${context} — ${detail}`
      : `${stageLabel}: ${detail}`;

    super(message);
    this.name = "RestoreStepError";
    this.stage = stage;
    this.detail = detail;
  }
}

export function formatRestoreCause(cause: unknown): string {
  if (cause instanceof RestoreStepError) {
    return cause.detail;
  }
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  if (cause && typeof cause === "object") {
    const record = cause as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code].filter(Boolean);
    if (parts.length > 0) {
      return parts.map(String).join(" | ");
    }
  }
  return String(cause ?? "erro desconhecido");
}

export async function runRestoreStage<T>(
  stage: RestoreStage,
  fn: () => Promise<T> | T
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new RestoreStepError(stage, cause);
  }
}
