"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 size-8 text-warning" />
      <h2 className="font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted-foreground">{error.message || "An unexpected error occurred while loading this page."}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
