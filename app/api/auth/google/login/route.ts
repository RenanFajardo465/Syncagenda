import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { createState } from "@/lib/auth/oauth-state";
import { googleAuthorizeUrl } from "@/lib/providers/google-oauth";

export async function GET() {
  if (!(await getSession())) return NextResponse.redirect(`${env().APP_BASE_URL}/`);
  const state = await createState("google");
  return NextResponse.redirect(googleAuthorizeUrl(state));
}
