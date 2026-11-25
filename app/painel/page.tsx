import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/supabase";
import type { ConnectionRow, Provider } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  ok: { text: "OK", cls: "bg-green-100 text-green-800" },
  error: { text: "Erro", cls: "bg-amber-100 text-amber-800" },
  needs_reconnect: { text: "Precisa reconectar", cls: "bg-red-100 text-red-800" },
};

function ConnectionCard({ title, conn, connectHref }: { title: string; conn?: ConnectionRow; connectHref?: string }) {
  const status = conn ? STATUS_LABEL[conn.status] : null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {status ? (
          <span className={`rounded px-2 py-0.5 text-xs ${status.cls}`}>{status.text}</span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Não conectado</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">{conn?.account_email ?? "—"}</p>
      {conn?.last_error && <p className="mt-1 text-xs text-red-700">{conn.last_error}</p>}
      {connectHref && (
        <a href={connectHref} className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">
          {conn ? "Reconectar Google" : "Conectar Google"}
        </a>
      )}
    </div>
  );
}

export default async function Painel({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; sync?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { erro, ok, sync } = await searchParams;

  const { data } = await db().from("connections").select("*").eq("user_id", session.uid);
  const byProvider = new Map((data as ConnectionRow[] | null)?.map((c) => [c.provider as Provider, c]) ?? []);
  const google = byProvider.get("google");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sync Agendas</h1>
          <p className="text-sm text-slate-600">{session.email}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="text-sm text-slate-600 underline">Sair</button>
        </form>
      </header>

      {erro && <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {sync && <p className="mt-6 rounded-md bg-blue-50 p-3 text-sm text-blue-900">Sincronização concluída. {sync}</p>}
      {ok === "google" && <p className="mt-6 rounded-md bg-green-50 p-3 text-sm text-green-800">Google conectado com sucesso.</p>}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <ConnectionCard title="Microsoft (Outlook/Teams)" conn={byProvider.get("microsoft")} />
        <ConnectionCard
          title="Google Agenda"
          conn={google}
          connectHref={!google || google.status !== "ok" ? "/api/auth/google/login" : undefined}
        />
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Sincronização</h2>
        <p className="mt-1 text-sm text-slate-600">
          Confere todos os eventos de 7 dias atrás até 180 dias à frente e acerta as cópias nos dois sentidos.
        </p>
        <form action="/api/sync/now" method="post" className="mt-3">
          <button
            disabled={!google || google.status !== "ok"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Sincronizar agora
          </button>
        </form>
      </section>
    </main>
  );
}
