"use client";

import { Suspense } from "react";
import { ActivityPanel } from "@/features/activity/components/ActivityPanel";
import { PageLoading } from "@/components/shared/PageLoading";

export default function ActivityPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ActivityPanel />
    </Suspense>
  );
}
