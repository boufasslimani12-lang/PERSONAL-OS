"use client";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/form";

/** Checkbox that flips immediately (optimistic) and reverts if the async save fails. */
export function ToggleCheck({ checked, onToggle, label }: { checked: boolean; onToggle: (next: boolean) => Promise<boolean | void>; label?: string }) {
  const [value, setValue] = useState(checked);
  useEffect(() => setValue(checked), [checked]);
  return (
    <Checkbox
      aria-label={label}
      checked={value}
      onChange={async (e) => {
        const next = e.target.checked;
        setValue(next);
        const ok = await onToggle(next);
        if (ok === false) setValue(!next);
      }}
    />
  );
}
