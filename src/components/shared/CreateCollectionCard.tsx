"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

interface CreateCollectionCardProps {
  onClick: () => void;
  index?: number;
}

export function CreateCollectionCard({ onClick, index = 0 }: CreateCollectionCardProps) {
  const t = useT();

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-label={t("collections.newCollection")}
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-xl border border-dashed",
        "border-border/80 bg-card/30 text-muted-foreground",
        "transition-[border-color,background-color,box-shadow] duration-200",
        "hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_20px_hsla(221,83%,53%,0.1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-muted/30 transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary/10">
          <Plus className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
        </div>
        <span className="text-sm font-medium">{t("collections.newCollection")}</span>
      </div>
    </motion.button>
  );
}
