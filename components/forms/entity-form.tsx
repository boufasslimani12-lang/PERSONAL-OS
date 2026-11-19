"use client";
import * as React from "react";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form";
import { useDb } from "@/lib/hooks/use-db";
import type { TableName } from "@/lib/types";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "textarea" | "markdown" | "number" | "date" | "time" | "datetime" | "select" | "checkbox" | "color" | "tags" | "url";

export interface Field {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  /** span both columns of the grid */
  full?: boolean;
  /** hide unless predicate on current values is true */
  showIf?: (values: Record<string, unknown>) => boolean;
}

type Values = Record<string, unknown>;

function toInput(f: Field, v: unknown): unknown {
  if (v === null || v === undefined) return f.type === "checkbox" ? false : "";
  if (f.type === "tags" && Array.isArray(v)) return v.join(", ");
  if (f.type === "datetime" && typeof v === "string") {
    const d = new Date(v);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (f.type === "time" && typeof v === "string") return v.slice(0, 5);
  return v;
}

function buildSchema(fields: Field[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "number": {
        let n = z.number({ message: `${f.label} must be a number` });
        if (f.min !== undefined) n = n.min(f.min, `${f.label} must be ≥ ${f.min}`);
        if (f.max !== undefined) n = n.max(f.max, `${f.label} must be ≤ ${f.max}`);
        s = f.required ? n : n.nullable();
        break;
      }
      case "checkbox":
        s = z.boolean();
        break;
      case "tags":
        s = z.array(z.string());
        break;
      case "url": {
        const u = z.string().url(`${f.label} must be a valid URL`);
        s = f.required ? u : u.nullable();
        break;
      }
      default: {
        const t = z.string().max(20000);
        s = f.required ? t.min(1, `${f.label} is required`) : t.nullable();
      }
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}

function fromInput(f: Field, raw: unknown): unknown {
  if (f.type === "checkbox") return Boolean(raw);
  if (f.type === "tags") return String(raw ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const s = typeof raw === "string" ? raw.trim() : raw;
  if (s === "" || s === undefined || s === null) return f.required ? "" : null;
  if (f.type === "number") return Number(s);
  if (f.type === "datetime") return new Date(String(s)).toISOString();
  return s;
}

export interface EntityFormProps {
  table: TableName;
  title: string;
  description?: string;
  fields: Field[];
  open: boolean;
  onClose: () => void;
  /** existing row → update; otherwise insert */
  record?: { id: string } | null;
  /** extra fixed values merged into the payload (e.g. foreign keys) */
  extra?: Values;
  /** default values for a new record */
  defaults?: Values;
  allowDelete?: boolean;
  /** custom transform before saving */
  transform?: (values: Values) => Values;
  onSaved?: () => void;
}

export function EntityForm({ table, title, description, fields, open, onClose, record, extra, defaults, allowDelete = true, transform, onSaved }: EntityFormProps) {
  const db = useDb();
  const [values, setValues] = React.useState<Values>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const src = ((record as Values | null | undefined) ?? defaults ?? {}) as Values;
    const v: Values = {};
    for (const f of fields) v[f.name] = toInput(f, src[f.name]);
    setValues(v);
    setErrors({});
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed: Values = {};
    for (const f of visible) parsed[f.name] = fromInput(f, values[f.name]);
    const result = buildSchema(visible).safeParse(parsed);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    let payload: Values = { ...(result.data as Values), ...extra };
    if (transform) payload = transform(payload);
    const ok = record ? await db.update(table, record.id, payload as never) : await db.insert(table, payload as never);
    if (ok) {
      onSaved?.();
      onClose();
    }
  }

  async function del() {
    if (!record) return;
    if (!confirmDelete) return setConfirmDelete(true);
    if (await db.remove(table, record.id)) onClose();
  }

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((f) => (
            <div key={f.name} className={cn("space-y-1", (f.full || f.type === "textarea" || f.type === "markdown") && "sm:col-span-2", f.type === "checkbox" && "flex items-center gap-2 space-y-0 self-end py-2")}>
              {f.type === "checkbox" ? (
                <>
                  <Checkbox id={f.name} checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                  <Label htmlFor={f.name} className="text-sm text-foreground">{f.label}</Label>
                </>
              ) : (
                <>
                  <Label htmlFor={f.name}>
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput f={f} value={values[f.name]} onChange={(v) => set(f.name, v)} />
                </>
              )}
              {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
              {errors[f.name] && <p className="text-[11px] text-destructive">{errors[f.name]}</p>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <div>
            {record && allowDelete && (
              <Button variant={confirmDelete ? "destructive" : "ghost"} size="sm" onClick={del} loading={db.pending && confirmDelete}>
                <Trash2 /> {confirmDelete ? "Confirm delete" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={db.pending && !confirmDelete}>{record ? "Save changes" : "Create"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const common = { id: f.name, placeholder: f.placeholder, value: (value ?? "") as string };
  switch (f.type) {
    case "textarea":
      return <Textarea {...common} onChange={(e) => onChange(e.target.value)} />;
    case "markdown":
      return <Textarea {...common} className="min-h-48 font-mono text-[13px]" onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <Select {...common} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">—</option>}
          {f.required && !value && <option value="">Select…</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      );
    case "number":
      return <Input {...common} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step ?? "any"} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input {...common} type="date" onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <Input {...common} type="time" onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <Input {...common} type="datetime-local" onChange={(e) => onChange(e.target.value)} />;
    case "color":
      return <Input {...common} type="color" className="h-9 w-20 p-1" value={(value as string) || "#6366f1"} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <Input {...common} type="url" onChange={(e) => onChange(e.target.value)} />;
    case "tags":
      return <Input {...common} placeholder={f.placeholder ?? "comma, separated, tags"} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input {...common} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Convenience hook: manage "which record is open in the form" state. */
export function useFormState<T extends { id: string }>() {
  const [state, setState] = React.useState<{ open: boolean; record: T | null; defaults?: Record<string, unknown> }>({ open: false, record: null });
  return {
    open: state.open,
    record: state.record,
    defaults: state.defaults,
    create: (defaults?: Record<string, unknown>) => setState({ open: true, record: null, defaults }),
    edit: (record: T) => setState({ open: true, record }),
    close: () => setState((s) => ({ ...s, open: false })),
  };
}
