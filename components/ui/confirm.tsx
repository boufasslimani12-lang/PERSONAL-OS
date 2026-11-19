"use client";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** "danger" for irreversible deletions (default), "default" otherwise */
  tone?: "danger" | "default";
}

type Ask = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = React.createContext<Ask>(async () => false);

/** App-wide confirmation dialog. `const confirm = useConfirm(); if (await confirm({ title })) …` */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = React.useCallback<Ask>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const danger = (state?.tone ?? "danger") === "danger";
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ""}
        className="w-[min(100vw-1.5rem,26rem)]"
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button variant={danger ? "destructive" : "default"} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel ?? (danger ? "Delete" : "Confirm")}
            </Button>
          </>
        }
      >
        <div className="flex gap-3 text-sm">
          {danger && <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
          <p className="text-muted-foreground">{state?.description ?? "This can't be undone."}</p>
        </div>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => React.useContext(Ctx);
