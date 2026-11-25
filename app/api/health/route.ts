import { NextResponse } from "next/server";
import { checkEnv } from "@/lib/env";

// Verificação simples: diz quais variáveis de ambiente estão faltando (sem mostrar valores).
export async function GET() {
  const { ok, missing } = checkEnv();
  return NextResponse.json({ ok, missing }, { status: ok ? 200 : 500 });
}
