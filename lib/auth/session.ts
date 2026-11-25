import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { safeEqual, sign } from "@/lib/crypto";

const COOKIE = "sa_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type Session = { uid: string; email: string; exp: number };

function encode(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body, env().SESSION_SECRET)}`;
}

function decode(raw: string | undefined): Session | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !safeEqual(sig, sign(body, env().SESSION_SECRET))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return decode((await cookies()).get(COOKIE)?.value);
}

export async function setSession(uid: string, email: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  (await cookies()).set(COOKIE, encode({ uid, email, exp }), {
    httpOnly: true,
    secure: env().APP_BASE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
