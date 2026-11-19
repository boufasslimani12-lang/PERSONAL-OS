import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-5xl font-semibold">404</p>
        <p className="mt-2 text-muted-foreground">This page doesn&apos;t exist.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary underline">Back to dashboard</Link>
      </div>
    </div>
  );
}
