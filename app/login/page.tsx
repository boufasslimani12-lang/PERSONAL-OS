import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { SetupRequired } from "@/components/layout/setup-required";
import { missingSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const missing = missingSupabaseEnv();
  if (missing.length) return <SetupRequired missing={missing} />;
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] p-4">
      <Suspense>
        <LoginForm allowSignup={process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true"} />
      </Suspense>
    </div>
  );
}
