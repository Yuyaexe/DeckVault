"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ResponsiveSelectOption {
  value: string;
  label: string;
}

interface ResponsiveSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ResponsiveSelectOption[];
  placeholder?: string;
  triggerClassName?: string;
  /** Always use native `<select>` (e.g. inside Sheet). */
  preferNative?: boolean;
}

export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  placeholder,
  triggerClassName,
  preferNative = false,
}: ResponsiveSelectProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const useNative = preferNative || isMobile;

  if (useNative) {
    return (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "flex w-full min-w-0 min-h-10 appearance-none rounded-md border border-input bg-background px-3 py-2.5 text-base leading-normal shadow-sm focus:outline-none focus:ring-2 focus:ring-ring sm:py-2 sm:text-sm",
          triggerClassName
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-9", triggerClassName)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[300]">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
