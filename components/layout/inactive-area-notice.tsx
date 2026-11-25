"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EyeOff } from "lucide-react";

/** Shown on a module page whose life area is inactive (reachable by URL; data is kept). */
export function InactiveAreaNotice({ pages }: { pages: { href: string; name: string }[] }) {
  const path = usePathname();
  const page = pages.find((p) => path === p.href || path.startsWith(p.href + "/"));
  if (!page) return null;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm">
      <EyeOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 text-muted-foreground">
        <span className="font-medium text-foreground">{page.name}</span> is inactive: it&apos;s hidden from navigation and excluded from scores. Your data is kept.
      </span>
      <Link href="/settings#life-areas" className="text-xs font-medium text-primary hover:underline">Reactivate in Settings</Link>
    </div>
  );
}
