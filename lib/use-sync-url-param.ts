"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Syncs a URL query param with a value from the page state (e.g. deal.status).
 *
 * When `value` changes (e.g. after a stage transition), this hook updates
 * the URL query param so the sidebar active-state highlighting reflects
 * the current module/stage the user is viewing.
 *
 * @param value   - The current value to sync (e.g. deal.status). Empty/null = no-op.
 * @param paramKey - The URL query param name (e.g. "status", "stage", "type").
 */
export function useSyncUrlParam(value: string | undefined | null, paramKey: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!value) return;
    const current = searchParams.get(paramKey) || "";
    if (current !== value) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramKey, value);
      const path = window.location.pathname;
      router.replace(`${path}?${params.toString()}`, { scroll: false });
    }
  }, [value, paramKey, router, searchParams]);
}
