import { Settings2 } from "lucide-react";

/** Shown instead of crashing when the deployment is missing its Supabase configuration. */
export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Settings2 className="size-5" /></span>
        <h1 className="mt-4 text-lg font-semibold">Configuration required</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal OS can&apos;t reach its database because these environment variables are not set for this deployment:
        </p>
        <ul className="mt-3 space-y-1">
          {missing.map((m) => <li key={m}><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{m}</code></li>)}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Add them in Vercel → Project → Settings → Environment Variables (values from Supabase → Project Settings → API),
          then redeploy. Both values are public; never add a service-role key.
        </p>
      </div>
    </div>
  );
}
