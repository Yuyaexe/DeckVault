export const NO_ACTIVE_COLLECTION = "Collection required";

export class CollectionRequiredError extends Error {
  constructor() {
    super(NO_ACTIVE_COLLECTION);
    this.name = "CollectionRequiredError";
  }
}

export function parseCollectionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requireCollectionId(value: unknown): string {
  const id = parseCollectionId(value);
  if (!id) throw new CollectionRequiredError();
  return id;
}
