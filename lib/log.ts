import "server-only";
import { db } from "@/lib/supabase";
import type { Direction, LogAction } from "@/lib/types";

/** Remove qualquer coisa parecida com token antes de gravar no log. */
function scrub(text: string): string {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[oculto]")
    .replace(/("?(access_token|refresh_token|id_token|client_secret|code)"?\s*[:=]\s*"?)[^",&\s]+/gi, "$1[oculto]")
    .slice(0, 1000);
}

export async function logAction(entry: {
  userId: string | null;
  direction: Direction;
  action: LogAction;
  sourceEventId?: string | null;
  message?: string;
}): Promise<void> {
  const { error } = await db()
    .from("sync_log")
    .insert({
      user_id: entry.userId,
      direction: entry.direction,
      action: entry.action,
      source_event_id: entry.sourceEventId ?? null,
      message: entry.message ? scrub(entry.message) : null,
    });
  if (error) console.error("Falha ao gravar sync_log:", error.message);
}

export function errorMessage(err: unknown): string {
  return scrub(err instanceof Error ? err.message : String(err));
}
