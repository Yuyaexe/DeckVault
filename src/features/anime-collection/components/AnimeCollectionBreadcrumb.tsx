"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

export interface AnimeCollectionBreadcrumbItem {
  label: string;
  href?: string;
}

export interface AnimeCollectionBreadcrumbProps {
  items: AnimeCollectionBreadcrumbItem[];
  className?: string;
}

export function AnimeCollectionBreadcrumb({
  items,
  className,
}: AnimeCollectionBreadcrumbProps) {
  const t = useT();

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("anime.breadcrumbLabel")}
      className={cn("mb-4 flex flex-wrap items-center gap-1 text-sm", className)}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="max-w-[12rem] truncate text-muted-foreground transition-colors hover:text-foreground sm:max-w-xs"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "max-w-[12rem] truncate sm:max-w-xs",
                    isLast
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
