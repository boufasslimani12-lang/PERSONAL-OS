"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Opens a module's own creation dialog when the URL carries `?new=<value>` (used by Dashboard quick actions),
 * then removes the parameter so a refresh doesn't reopen it. Reuses the module's existing flow.
 */
export function useCreateFromQuery(accept: string[], open: (value: string) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get("new");
  const [handled, setHandled] = useState<string | null>(null);
  if (value && value !== handled && accept.includes(value)) {
    setHandled(value);
    open(value);
  }
  useEffect(() => {
    if (!value) return;
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [value, params, pathname, router]);
}
