"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";
import { LocalModeBanner } from "@/components/shared/LocalModeBanner";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useAnimeCloudShareSync } from "@/features/anime-collection/hooks/useAnimeCloudShareSync";
import { cn } from "@/lib/utils";

const ImportModal = dynamic(
  () => import("@/features/import/components/ImportModal").then((m) => m.ImportModal),
  { ssr: false }
);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const importOpen = useCollectionUIStore((s) => s.importOpen);
  const setImportOpen = useCollectionUIStore((s) => s.setImportOpen);
  useAnimeCloudShareSync();

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <div className="hidden md:flex md:h-full">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        )}
      >
        <LocalModeBanner />
        {children}
      </main>
      <MobileBottomNav />
      {importOpen && <ImportModal open={importOpen} onOpenChange={setImportOpen} />}
    </div>
  );
}
