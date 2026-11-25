import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSession()) redirect("/painel");
  const { erro } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <h1 className="text-2xl font-semibold">Sync Agendas</h1>
      <p className="mt-2 text-slate-600">Sincronização em tempo real entre Outlook (Microsoft 365) e Google Agenda.</p>
      {erro && <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <a
        href="/api/auth/microsoft/login"
        className="mt-8 inline-block rounded-md bg-slate-900 px-5 py-3 text-white hover:bg-slate-700"
      >
        Entrar com a conta Microsoft
      </a>
    </main>
  );
}
