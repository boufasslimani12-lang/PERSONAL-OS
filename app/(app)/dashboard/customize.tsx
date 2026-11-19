"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { useDb } from "@/lib/hooks/use-db";

export const DASHBOARD_WIDGETS = [
  { key: "areas", label: "Life areas" },
  { key: "today_tasks", label: "Today's tasks" },
  { key: "today_habits", label: "Today's habits" },
  { key: "deadlines", label: "Upcoming deadlines" },
  { key: "events", label: "Upcoming events" },
  { key: "weekly_goals", label: "Weekly goals" },
  { key: "stats", label: "Key statistics" },
  { key: "productivity", label: "Weekly productivity" },
  { key: "monthly", label: "Monthly performance" },
  { key: "activity", label: "Recent activity" },
];

export function CustomizeDashboard({ hidden }: { hidden: string[] }) {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(new Set(hidden));
  async function save() {
    const { data } = await db.supabase.auth.getUser();
    if (!data.user) return;
    const ok = await db.run(() => db.supabase.from("profiles").update({ dashboard_widgets: [...sel] }).eq("user_id", data.user!.id), "Dashboard updated");
    if (ok) setOpen(false);
  }
  return (
    <>
      <Button variant="outline" size="icon" onClick={() => { setSel(new Set(hidden)); setOpen(true); }} aria-label="Customize dashboard" title="Customize dashboard"><SlidersHorizontal /></Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Customize dashboard" description="Choose which widgets to show."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={db.pending}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-2">
          {DASHBOARD_WIDGETS.map((w) => (
            <label key={w.key} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
              <Checkbox checked={!sel.has(w.key)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.delete(w.key); else n.add(w.key); setSel(n); }} />
              {w.label}
            </label>
          ))}
        </div>
      </Dialog>
    </>
  );
}
