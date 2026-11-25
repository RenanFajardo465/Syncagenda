import "server-only";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import type { TokenResponse } from "@/lib/providers/microsoft-oauth";

export const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.events"];

export const googleRedirectUri = () => `${env().APP_BASE_URL}/api/auth/google/callback`;

export function googleAuthorizeUrl(state: string, loginHint?: string): string {
  const p = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID,
    response_type: "code",
    redirect_uri: googleRedirectUri(),
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // garante refresh token
    prompt: "consent", // garante refresh token mesmo em reconexões
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) p.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse & { scope?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env().GOOGLE_CLIENT_ID,
      client_secret: env().GOOGLE_CLIENT_SECRET,
      ...params,
    }),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text(), `Google token: HTTP ${res.status}`);
  return (await res.json()) as TokenResponse & { scope?: string };
}

export const googleExchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: googleRedirectUri() });

export const googleRefresh = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

export async function googleGetUserInfo(accessToken: string): Promise<{ email: string }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(res.status, await res.text(), "Falha ao ler o perfil Google");
  const info = (await res.json()) as { email: string };
  return { email: info.email.toLowerCase() };
}
