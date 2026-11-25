import { NextResponse } from "next/server";
import { createState } from "@/lib/auth/oauth-state";
import { msAuthorizeUrl } from "@/lib/providers/microsoft-oauth";

export async function GET() {
  const state = await createState("microsoft");
  return NextResponse.redirect(msAuthorizeUrl(state));
}
