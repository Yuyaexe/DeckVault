"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CollectionFilters } from "@/features/collection/components/CollectionFilters";
import { useT, useLocale } from "@/lib/i18n/context";

export function MobileFilters() {
  const t = useT();
  const locale = useLocale();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="h-4 w-4" />
          {t("collection.filters")}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        lang={locale === "pt-BR" ? "pt-BR" : "en"}
        className="flex h-full w-[min(100vw-1rem,20rem)] max-w-[85vw] flex-col p-0"
      >
        <SheetHeader className="shrink-0 p-4 pb-0">
          <SheetTitle>{t("collection.filters")}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <CollectionFilters inSheet />
        </div>
      </SheetContent>
    </Sheet>
  );
}
