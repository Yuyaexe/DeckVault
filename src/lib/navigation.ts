import {
  Layers,
  LayoutGrid,
  History,
  Printer,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

export interface AppNavItem {
  href: string;
  labelKey: MessageKey;
  shortLabelKey: MessageKey;
  icon: LucideIcon;
}

export const appNavItems: AppNavItem[] = [
  {
    href: "/collections",
    labelKey: "nav.collectionManager",
    shortLabelKey: "nav.collectionManagerShort",
    icon: LayoutGrid,
  },
  {
    href: "/collection",
    labelKey: "nav.collection",
    shortLabelKey: "nav.collectionShort",
    icon: Layers,
  },
  {
    href: "/activity",
    labelKey: "nav.activity",
    shortLabelKey: "nav.activityShort",
    icon: History,
  },
  {
    href: "/anime-collection",
    labelKey: "nav.animeCollection",
    shortLabelKey: "nav.animeCollectionShort",
    icon: Sparkles,
  },
  {
    href: "/proxy-print",
    labelKey: "nav.proxyPrint",
    shortLabelKey: "nav.proxyPrintShort",
    icon: Printer,
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    shortLabelKey: "nav.settingsShort",
    icon: Settings,
  },
];
