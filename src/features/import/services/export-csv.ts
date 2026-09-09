import type { DemoOwnedCard } from "@/lib/demo/types";

export function exportCollectionCsv(cards: DemoOwnedCard[], collectionName: string) {
  const headers = [
    "Name",
    "Game",
    "Set",
    "Collector Number",
    "Quantity",
    "Condition",
    "Language",
    "Foil",
    "Purchase Price",
    "Notes",
  ];

  const rows = cards.map((oc) => [
    oc.card.name,
    oc.card.gameName,
    oc.card.setName ?? "",
    oc.card.collectorNumber ?? "",
    oc.quantity.toString(),
    oc.condition,
    oc.language,
    oc.isFoil ? "Yes" : "No",
    oc.purchasePrice?.toFixed(2) ?? "",
    oc.notes ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${collectionName.replace(/\s+/g, "_")}_export.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
