import "server-only";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export const MS_SCOPES = ["openid", "email", "profile", "offline_access", "User.Read", "Calendars.ReadWrite"];

const authority = () => `https://login.microsoftonline.com/${env().MS_TENANT_ID}/oauth2/v2.0`;
export const msRedirectUri = () => `${env().APP_BASE_URL}/api/auth/microsoft/callback`;

export function msAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env().MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: msRedirectUri(),
    response_mode: "query",
    scope: MS_SCOPES.join(" "),
    state,
    prompt: "select_account",
  });
  return `${authority()}/authorize?${p}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${authority()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env().MS_CLIENT_ID,
      client_secret: env().MS_CLIENT_SECRET,
      scope: MS_SCOPES.join(" "),
      ...params,
    }),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text(), `Microsoft token: HTTP ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export const msExchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: msRedirectUri() });

export const msRefresh = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

export async function msGetMe(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(res.status, await res.text(), "Falha ao ler o perfil Microsoft");
  const me = (await res.json()) as { displayName?: string; mail?: string | null; userPrincipalName: string };
  return { email: (me.mail || me.userPrincipalName).toLowerCase(), name: me.displayName ?? "" };
}
