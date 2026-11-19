"use client";
import { ExternalLink, Plus, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import type { Row } from "@/lib/types";

const KINDS = ["link", "book", "course", "video", "article", "tool", "project", "other"].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }));
const STATUS = [{ value: "todo", label: "To do" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }];
const fields: Field[] = [
  { name: "title", label: "Title", required: true, full: true },
  { name: "url", label: "URL", type: "url", full: true },
  { name: "kind", label: "Type", type: "select", required: true, options: KINDS },
  { name: "status", label: "Status", type: "select", required: true, options: STATUS },
  { name: "notes", label: "Notes", type: "textarea" },
];

/** Learning resources linked to a language, skill or project. */
export function ResourceList({ resources, link }: { resources: Row<"resources">[]; link: { language_id?: string; skill_id?: string; project_id?: string } }) {
  const form = useFormState<Row<"resources">>();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Library className="size-4" /> Resources</h3>
        <Button size="sm" variant="ghost" onClick={() => form.create({ kind: "link", status: "todo" })}><Plus /> Add</Button>
      </div>
      {resources.length ? (
        <ul className="space-y-1">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <button className="truncate text-left hover:text-primary" onClick={() => form.edit(r)}>{r.title}</button>
              <span className="flex shrink-0 items-center gap-1">
                <Badge>{r.kind}</Badge>
                <Badge tone={r.status === "done" ? "success" : r.status === "in_progress" ? "info" : "default"}>{STATUS.find((s) => s.value === r.status)?.label}</Badge>
                {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label="Open link"><ExternalLink className="size-3.5 text-muted-foreground" /></a>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">No resources yet.</p>}
      <EntityForm table="resources" title={form.record ? "Edit resource" : "New resource"} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults} extra={link} />
    </div>
  );
}
