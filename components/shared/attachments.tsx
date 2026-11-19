"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDb } from "@/lib/hooks/use-db";
import { useConfirm } from "@/components/ui/confirm";
import type { Row } from "@/lib/types";

type EntityType = "subject" | "lesson" | "assessment" | "note" | "project" | "goal";
const MAX = 25 * 1024 * 1024;

/** Files stored in the private "attachments" bucket under <user_id>/<entity_type>/<entity_id>/... */
export function Attachments({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const db = useDb();
  const confirm = useConfirm();
  const [items, setItems] = useState<Row<"attachments">[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const supabase = db.supabase;
  const fetchItems = useCallback(
    () => supabase.from("attachments").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at"),
    [supabase, entityType, entityId],
  );
  const load = useCallback(async () => setItems((await fetchItems()).data ?? []), [fetchItems]);
  useEffect(() => {
    let active = true;
    fetchItems().then(({ data }) => { if (active) setItems(data ?? []); });
    return () => { active = false; };
  }, [fetchItems]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const { data: u } = await db.supabase.auth.getUser();
    for (const f of Array.from(files)) {
      if (f.size > MAX) { db.toast(`${f.name} is larger than 25 MB`, "error"); continue; }
      const safe = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `${u.user!.id}/${entityType}/${entityId}/${crypto.randomUUID()}-${safe}`;
      const up = await db.supabase.storage.from("attachments").upload(path, f, { contentType: f.type || undefined });
      if (up.error) { db.toast(up.error.message, "error"); continue; }
      const ins = await db.supabase.from("attachments").insert({ entity_type: entityType, entity_id: entityId, storage_path: path, file_name: f.name, mime_type: f.type || null, size_bytes: f.size });
      if (ins.error) { await db.supabase.storage.from("attachments").remove([path]); db.toast(ins.error.message, "error"); }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    load();
  }

  async function open(a: Row<"attachments">) {
    const { data, error } = await db.supabase.storage.from("attachments").createSignedUrl(a.storage_path, 60);
    if (error) return db.toast(error.message, "error");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function remove(a: Row<"attachments">) {
    if (!(await confirm({ title: `Delete ${a.file_name}?`, description: "The file is removed from storage." }))) return;
    await db.supabase.storage.from("attachments").remove([a.storage_path]);
    await db.supabase.from("attachments").delete().eq("id", a.id);
    load();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="size-4" /> Attachments</h3>
        <Button size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}><Upload /> Upload</Button>
        <input ref={input} type="file" multiple hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={(e) => upload(e.target.files)} />
      </div>
      {items.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="truncate">{a.file_name}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {a.size_bytes ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : ""}
                <Button size="icon" variant="ghost" onClick={() => open(a)} aria-label="Open"><Download /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(a)} aria-label="Delete"><Trash2 /></Button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">PDFs, documents and images up to 25 MB.</p>}
    </div>
  );
}
