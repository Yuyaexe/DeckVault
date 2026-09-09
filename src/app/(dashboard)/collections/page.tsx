"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CollectionManager } from "@/features/collection/components/CollectionManager";
import { useT } from "@/lib/i18n/context";

export default function CollectionsPage() {
  const t = useT();

  return (
    <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
      <PageHeader
        title={t("collectionsPage.title")}
        description={t("collectionsPage.description")}
      />

      <div className="mt-8">
        <CollectionManager />
      </div>
    </div>
  );
}
