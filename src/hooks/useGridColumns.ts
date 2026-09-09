"use client";

import { useEffect, useState } from "react";

const BREAKPOINTS = [
  { minWidth: 1280, columns: 6 },
  { minWidth: 1024, columns: 5 },
  { minWidth: 768, columns: 4 },
  { minWidth: 640, columns: 3 },
  { minWidth: 0, columns: 2 },
] as const;

function columnsForWidth(width: number): number {
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) return bp.columns;
  }
  return 2;
}

/** Single resize listener for collection grid column count. */
export function useGridColumns(): number {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const update = () => setColumns(columnsForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
}
