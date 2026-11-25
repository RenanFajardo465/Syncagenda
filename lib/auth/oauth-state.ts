import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { randomToken, safeEqual } from "@/lib/crypto";

// Proteção CSRF do fluxo OAuth: um valor aleatório guardado em cookie e conferido no retorno.
const cookieName = (provider: string) => `sa_oauth_${provider}`;

export async function createState(provider: "microsoft" | "google"): Promise<string> {
  const state = randomToken(24);
  (await cookies()).set(cookieName(provider), state, {
    httpOnly: true,
    secure: env().APP_BASE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return state;
}

export async function consumeState(provider: "microsoft" | "google", received: string | null): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(cookieName(provider))?.value;
  store.delete({ name: cookieName(provider), path: "/api/auth" });
  return Boolean(expected && received && safeEqual(expected, received));
}
