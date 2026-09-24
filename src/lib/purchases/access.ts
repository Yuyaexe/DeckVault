export function canAccessCardTraderPurchases(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.DECKVAULT_DESKTOP === "1") return true;
  return process.env.DECKVAULT_ALLOW_CARDTRADER_PURCHASES === "1";
}
