"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X, Sparkles } from "lucide-react";
import { NAV, MOBILE_PRIMARY } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ThemeToggle } from "./theme-toggle";

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

function NavList({ onNavigate, hiddenHrefs }: { onNavigate?: () => void; hiddenHrefs: string[] }) {
  const path = usePathname();
  const items = NAV.filter((n) => !hiddenHrefs.includes(n.href));
  const groups: { key: string; label: string }[] = [
    { key: "core", label: "Plan" },
    { key: "life", label: "Life areas" },
    { key: "system", label: "Insights" },
  ];
  return (
    <nav className="space-y-5" aria-label="Main">
      {groups.filter((g) => items.some((n) => n.group === g.key)).map((g) => (
        <div key={g.key}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.label}</p>
          <ul className="space-y-0.5">
            {items.filter((n) => n.group === g.key).map((n) => {
              const active = isActive(path, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                      active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <n.icon className="size-4 shrink-0" />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await getSupabaseBrowser().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="size-4" />
    </button>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
      Personal OS
    </Link>
  );
}

export function Sidebar({ name, hiddenHrefs }: { name: string; hiddenHrefs: string[] }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center px-4"><Brand /></div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <NavList hiddenHrefs={hiddenHrefs} />
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">{name}</span>
        <div className="flex">
          <ThemeToggle />
          <SignOut />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ hiddenHrefs }: { hiddenHrefs: string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex"><ThemeToggle /><SignOut /></div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {primary.map((n) => (
          <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px]", isActive(path, n.href) ? "text-primary" : "text-muted-foreground")}>
            <n.icon className="size-5" />
            {n.label.split(" ")[0]}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground">
          <Menu className="size-5" /> More
        </button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-sidebar p-3 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <Brand />
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted" aria-label="Close menu"><X className="size-5" /></button>
            </div>
            <NavList onNavigate={() => setOpen(false)} hiddenHrefs={hiddenHrefs} />
          </div>
        </div>
      )}
    </>
  );
}
