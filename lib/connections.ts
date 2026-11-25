import "server-only";
import { db } from "@/lib/supabase";
import { decrypt, encrypt } from "@/lib/crypto";
import { HttpError } from "@/lib/http";
import { errorMessage, logAction } from "@/lib/log";
import { msRefresh, type TokenResponse } from "@/lib/providers/microsoft-oauth";
import { googleRefresh } from "@/lib/providers/google-oauth";
import type { ConnectionRow, ConnectionStatus, Provider } from "@/lib/types";

export class NeedsReconnectError extends Error {
  constructor(public provider: Provider) {
    super(`A conta ${provider === "google" ? "Google" : "Microsoft"} precisa ser reconectada`);
  }
}

/** Cria ou atualiza o usuário do painel e garante as configurações padrão. */
export async function upsertAppUser(email: string, name: string): Promise<string> {
  const { data, error } = await db()
    .from("app_users")
    .upsert({ email, name }, { onConflict: "email" })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao salvar usuário: ${error.message}`);
  await db().from("user_settings").upsert({ user_id: data.id }, { onConflict: "user_id", ignoreDuplicates: true });
  return data.id as string;
}

/** Grava os tokens (criptografados) de uma conta conectada. */
export async function saveConnection(
  userId: string,
  provider: Provider,
  accountEmail: string,
  tokens: TokenResponse,
): Promise<void> {
  const existing = await getConnection(userId, provider);
  const refresh = tokens.refresh_token ?? (existing?.refresh_token_enc ? decrypt(existing.refresh_token_enc) : null);
  if (!refresh) throw new Error("O provedor não devolveu refresh token. Tente conectar de novo.");
  const { error } = await db()
    .from("connections")
    .upsert(
      {
        user_id: userId,
        provider,
        account_email: accountEmail,
        calendar_id: "primary",
        refresh_token_enc: encrypt(refresh),
        access_token_enc: encrypt(tokens.access_token),
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "ok",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
  if (error) throw new Error(`Falha ao salvar conexão: ${error.message}`);
}

export async function getConnection(userId: string, provider: Provider): Promise<ConnectionRow | null> {
  const { data, error } = await db()
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnectionRow) ?? null;
}

export async function setConnectionStatus(
  userId: string,
  provider: Provider,
  status: ConnectionStatus,
  lastError: string | null,
): Promise<void> {
  await db()
    .from("connections")
    .update({ status, last_error: lastError, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}

/**
 * Devolve um access token válido, renovando com o refresh token quando faltam menos de 2 minutos.
 * Se o acesso foi revogado, marca a conexão como "precisa reconectar".
 */
export async function getAccessToken(userId: string, provider: Provider): Promise<string> {
  const conn = await getConnection(userId, provider);
  if (!conn?.refresh_token_enc) throw new NeedsReconnectError(provider);
  if (conn.status === "needs_reconnect") throw new NeedsReconnectError(provider);

  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (conn.access_token_enc && expiresAt - Date.now() > 120_000) return decrypt(conn.access_token_enc);

  try {
    const refresh = decrypt(conn.refresh_token_enc);
    const tokens = provider === "google" ? await googleRefresh(refresh) : await msRefresh(refresh);
    await saveConnection(userId, provider, conn.account_email ?? "", tokens);
    return tokens.access_token;
  } catch (err) {
    const revoked = err instanceof HttpError && (err.status === 400 || err.status === 401) && /invalid_grant|interaction_required|revoked|expired/i.test(err.body);
    if (revoked) {
      await setConnectionStatus(userId, provider, "needs_reconnect", "Acesso revogado ou expirado. Conecte de novo.");
      await logAction({ userId, direction: "system", action: "error", message: `Conta ${provider} precisa ser reconectada` });
      throw new NeedsReconnectError(provider);
    }
    await setConnectionStatus(userId, provider, "error", errorMessage(err));
    throw err;
  }
}
