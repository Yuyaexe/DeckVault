import { resolveStoredBlueprintId } from "@/lib/cardtrader";
import { isCardTraderHostedImage } from "@/lib/cardtrader/images";

export { isCardTraderHostedImage };

/**
 * True when externalId is a Yu-Gi-Oh! Konami passcode (safe for images.ygoprodeck.com).
 * CardTrader blueprint IDs are numeric too — never treat those as passcodes.
 */
export function isYugiohPasscodeId(
  externalId: string | null | undefined,
  imageUrl?: string | null
): boolean {
  if (!externalId || !/^\d{7,10}$/.test(externalId)) return false;
  if (isCardTraderHostedImage(imageUrl)) return false;
  if (imageUrl?.includes("ygoprodeck.com")) return true;
  if (resolveStoredBlueprintId(externalId, imageUrl) != null && !imageUrl?.includes("ygoprodeck.com")) {
    return externalId.length >= 8;
  }
  return externalId.length >= 8;
}

export function resolveYugiohPasscode(
  externalId: string | null | undefined,
  imageUrl?: string | null,
  detailPasscode?: string | null
): string | null {
  if (detailPasscode && isYugiohPasscodeId(detailPasscode, null)) {
    return detailPasscode;
  }
  if (isYugiohPasscodeId(externalId, imageUrl)) {
    return externalId!;
  }
  return null;
}

export function isCardTraderBlueprintExternalId(
  externalId: string | null | undefined,
  imageUrl?: string | null,
  cardTraderBlueprintId?: string | null
): boolean {
  return (
    resolveStoredBlueprintId(externalId, imageUrl, cardTraderBlueprintId) != null
  );
}
