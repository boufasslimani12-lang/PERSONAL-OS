"use client";
import { useState } from "react";
import { Settings, Download, KeyRound, User, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox, Input, Label, Select } from "@/components/ui/form";
import { CURRENCIES, WEEKDAYS } from "@/lib/constants";
import { useDb } from "@/lib/hooks/use-db";
import { todayISO } from "@/lib/dates";
import type { LifeArea, Profile, TableName } from "@/lib/types";

const EXPORT_TABLES: TableName[] = [
  "profiles", "life_areas", "goals", "milestones", "projects", "tasks", "task_completions", "habits", "habit_logs", "events",
  "exercises", "workout_templates", "workout_template_exercises", "workouts", "workout_sets", "body_metrics",
  "academic_years", "semesters", "subjects", "courses", "chapters", "lessons", "study_sessions", "assessments",
  "languages", "language_sessions", "vocabulary", "skills", "skill_sessions", "skill_assessments", "resources",
  "finance_categories", "transactions", "savings_goals", "books", "growth_items", "notes", "attachments",
];

export function SettingsView({ email, profile, areas }: { email: string; profile: Profile | null; areas: LifeArea[] }) {
  const db = useDb();
  const [p, setP] = useState({
    display_name: profile?.display_name ?? "", currency: profile?.currency ?? "MAD",
    timezone: profile?.timezone ?? "Africa/Casablanca", week_starts_on: profile?.week_starts_on ?? 1,
  });
  const [pw, setPw] = useState("");
  const [exporting, setExporting] = useState(false);
  const timezones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [p.timezone];

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    await db.update("profiles", profile.id, { ...p, display_name: p.display_name.trim() || null }, "Profile saved");
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return db.toast("Use at least 8 characters", "error");
    const { error } = await db.supabase.auth.updateUser({ password: pw });
    if (error) db.toast(error.message, "error"); else { db.toast("Password updated"); setPw(""); }
  }
  async function exportAll() {
    setExporting(true);
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), app: "personal-os", version: 1 };
    for (const t of EXPORT_TABLES) {
      const { data, error } = await db.supabase.from(t).select("*");
      if (error) { db.toast(`${t}: ${error.message}`, "error"); setExporting(false); return; }
      out[t] = data;
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `personal-os-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExporting(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" icon={Settings} description="Profile, preferences, life areas and your data" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><User className="size-4" /> Profile & preferences</CardTitle><CardDescription>{email}</CardDescription></div></CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="dn">Display name</Label><Input id="dn" value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="cur">Default currency</Label><Select id="cur" value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
              <div className="space-y-1"><Label htmlFor="ws">Week starts on</Label><Select id="ws" value={p.week_starts_on} onChange={(e) => setP({ ...p, week_starts_on: Number(e.target.value) })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="tz">Time zone</Label><Select id="tz" value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}>{timezones.map((t) => <option key={t}>{t}</option>)}</Select></div>
              <div className="sm:col-span-2"><Button type="submit" loading={db.pending}>Save preferences</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><Layers className="size-4" /> Life areas</CardTitle><CardDescription>Rename, recolor or hide areas from scoring</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {areas.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <input type="color" defaultValue={a.color} className="h-8 w-9 rounded border border-input bg-card p-0.5" aria-label={`${a.name} color`} onBlur={(e) => e.target.value !== a.color && db.update("life_areas", a.id, { color: e.target.value }, "Color updated")} />
                <Input defaultValue={a.name} className="h-8" aria-label="Area name" onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && db.update("life_areas", a.id, { name: e.target.value.trim() }, "Renamed")} />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><Checkbox defaultChecked={a.is_active} onChange={(e) => db.update("life_areas", a.id, { is_active: e.target.checked }, e.target.checked ? "Area enabled" : "Area hidden")} /> Active</label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Security</CardTitle><CardDescription>Change your password</CardDescription></div></CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="flex gap-2">
              <Input type="password" autoComplete="new-password" placeholder="New password (min. 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Button type="submit" variant="outline" className="h-9">Update</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><Download className="size-4" /> Your data</CardTitle><CardDescription>Download everything as a single JSON file (attachment files stay in storage)</CardDescription></div></CardHeader>
          <CardContent><Button variant="outline" onClick={exportAll} loading={exporting}><Download /> Export all data</Button></CardContent>
        </Card>
      </div>
    </div>
  );
}
