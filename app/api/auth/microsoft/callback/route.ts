import { NextResponse, type NextRequest } from "next/server";
import { allowedEmails, env } from "@/lib/env";
import { consumeState } from "@/lib/auth/oauth-state";
import { setSession } from "@/lib/auth/session";
import { msExchangeCode, msGetMe } from "@/lib/providers/microsoft-oauth";
import { saveConnection, upsertAppUser } from "@/lib/connections";
import { errorMessage, logAction } from "@/lib/log";

const back = (error: string) => NextResponse.redirect(`${env().APP_BASE_URL}/?erro=${encodeURIComponent(error)}`);

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  if (url.searchParams.get("error")) return back(url.searchParams.get("error_description") ?? "Login cancelado");
  if (!(await consumeState("microsoft", url.searchParams.get("state")))) return back("Sessão de login expirada. Tente de novo.");
  const code = url.searchParams.get("code");
  if (!code) return back("Resposta da Microsoft sem código");

  try {
    const tokens = await msExchangeCode(code);
    const me = await msGetMe(tokens.access_token);
    if (!allowedEmails().includes(me.email)) return back(`O e-mail ${me.email} não tem acesso a este painel.`);
    const userId = await upsertAppUser(me.email, me.name);
    await saveConnection(userId, "microsoft", me.email, tokens);
    await setSession(userId, me.email);
    await logAction({ userId, direction: "system", action: "info", message: "Login Microsoft realizado" });
    return NextResponse.redirect(`${env().APP_BASE_URL}/painel`);
  } catch (err) {
    console.error("Erro no callback Microsoft:", errorMessage(err));
    return back("Não foi possível concluir o login Microsoft.");
  }
}
