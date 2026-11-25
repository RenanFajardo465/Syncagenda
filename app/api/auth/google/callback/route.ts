import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { consumeState } from "@/lib/auth/oauth-state";
import { GOOGLE_SCOPES, googleExchangeCode, googleGetUserInfo } from "@/lib/providers/google-oauth";
import { saveConnection } from "@/lib/connections";
import { errorMessage, logAction } from "@/lib/log";

const panel = (msg?: string) =>
  NextResponse.redirect(`${env().APP_BASE_URL}/painel${msg ? `?erro=${encodeURIComponent(msg)}` : "?ok=google"}`);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${env().APP_BASE_URL}/`);
  const url = req.nextUrl;
  if (url.searchParams.get("error")) return panel("Conexão com o Google cancelada");
  if (!(await consumeState("google", url.searchParams.get("state")))) return panel("Sessão expirada. Tente de novo.");
  const code = url.searchParams.get("code");
  if (!code) return panel("Resposta do Google sem código");

  try {
    const tokens = await googleExchangeCode(code);
    const calendarScope = GOOGLE_SCOPES[3];
    if (tokens.scope && !tokens.scope.split(" ").includes(calendarScope)) {
      return panel("Marque a permissão de acesso à agenda na tela do Google.");
    }
    const info = await googleGetUserInfo(tokens.access_token);
    await saveConnection(session.uid, "google", info.email, tokens);
    await logAction({ userId: session.uid, direction: "system", action: "info", message: `Google conectado (${info.email})` });
    return panel();
  } catch (err) {
    console.error("Erro no callback Google:", errorMessage(err));
    return panel("Não foi possível conectar o Google.");
  }
}
