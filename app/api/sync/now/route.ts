import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { fullSyncUser } from "@/lib/sync/engine";
import { NeedsReconnectError } from "@/lib/connections";
import { errorMessage, logAction } from "@/lib/log";

export const maxDuration = 300;

/** Botão "Sincronizar agora": ressincronização completa da janela, nos sentidos ligados. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${env().APP_BASE_URL}/`, 303);
  const base = `${env().APP_BASE_URL}/painel`;
  try {
    const results = await fullSyncUser(session.uid);
    const summary = results
      .map((r) => `${r.direction === "outlook_to_google" ? "Outlook→Google" : "Google→Outlook"}: ${r.created} criados, ${r.updated} atualizados, ${r.deleted} excluídos${r.errors ? `, ${r.errors} erros` : ""}`)
      .join(" · ");
    await logAction({ userId: session.uid, direction: "system", action: "info", message: `Sincronização manual: ${summary || "nenhum sentido ligado"}` });
    return NextResponse.redirect(`${base}?sync=${encodeURIComponent(summary || "Nenhum sentido está ligado.")}`, 303);
  } catch (err) {
    const msg = err instanceof NeedsReconnectError ? err.message : `Falha na sincronização: ${errorMessage(err)}`;
    await logAction({ userId: session.uid, direction: "system", action: "error", message: msg });
    return NextResponse.redirect(`${base}?erro=${encodeURIComponent(msg)}`, 303);
  }
}
