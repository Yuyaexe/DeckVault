"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      queryClient.clear();
      toast.success(t("auth.logout.success"));
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.logout.failed"));
    } finally {
      setLoading(false);
    }
  }, [queryClient, router, t]);

  return { signOut, loading };
}
