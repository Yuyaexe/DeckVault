export function canAccessCardTraderPurchases(userId: string | null): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.DECKVAULT_DESKTOP === "1") return true;
  const ownerId = process.env.CARDTRADER_OWNER_USER_ID;
  return Boolean(userId && ownerId && userId === ownerId);
}
