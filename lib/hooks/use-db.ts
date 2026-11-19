"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import type { Insert, TableName, Update } from "@/lib/types";

type Result = { error: { message: string } | null };

/**
 * Client-side mutations. Row Level Security guarantees the user can only touch their own rows.
 * After a successful write the current route is refreshed so Server Components re-fetch.
 */
export function useDb() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (op: () => PromiseLike<Result>, success?: string): Promise<boolean> => {
      setPending(true);
      try {
        const { error } = await op();
        if (error) {
          toast(error.message, "error");
          return false;
        }
        if (success) toast(success);
        router.refresh();
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Something went wrong", "error");
        return false;
      } finally {
        setPending(false);
      }
    },
    [router, toast],
  );

  const insert = useCallback(
    <T extends TableName>(table: T, values: Insert<T> | Insert<T>[], success = "Saved") =>
      run(() => supabase.from(table).insert(values as never), success),
    [run, supabase],
  );
  const update = useCallback(
    <T extends TableName>(table: T, id: string, values: Update<T>, success: string | undefined = "Saved") =>
      run(() => supabase.from(table).update(values as never).eq("id" as never, id as never), success),
    [run, supabase],
  );
  const remove = useCallback(
    <T extends TableName>(table: T, id: string, success = "Deleted") =>
      run(() => supabase.from(table).delete().eq("id" as never, id as never), success),
    [run, supabase],
  );

  return { supabase, run, insert, update, remove, pending, toast, refresh: router.refresh };
}
