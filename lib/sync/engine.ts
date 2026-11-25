import "server-only";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";
import { syncWindow } from "@/lib/config";
import { errorMessage, logAction } from "@/lib/log";
import { adapterFor, type Adapter } from "@/lib/sync/adapters";
import { buildCopy, contentHash, skipReason } from "@/lib/sync/mapping";
import { startInstant, type NormalizedEvent } from "@/lib/sync/model";
import type { Direction, Provider, UserSettings } from "@/lib/types";

type EventLink = {
  id: string;
  source_provider: Provider;
  source_event_id: string;
  target_provider: Provider;
  target_event_id: string;
  content_hash: string;
  source_start: string | null;
};

export type DirectionResult = {
  direction: Direction;
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  skipped: number;
  errors: number;
};

export const directionOf = (from: Provider): Direction => (from === "microsoft" ? "outlook_to_google" : "google_to_outlook");
const other = (p: Provider): Provider => (p === "microsoft" ? "google" : "microsoft");

export type SyncContext = {
  userId: string;
  settings: UserSettings;
  source: Adapter;
  target: Adapter;
  direction: Direction;
  /** ids que são cópias nossas no provedor de origem (checagem extra contra loop) */
  copyIdsInSource: Set<string>;
  links: Map<string, EventLink>;
  result: DirectionResult;
};

export async function loadSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await db().from("user_settings").select("*").eq("user_id", userId).single();
  if (error) throw new Error(`Configurações não encontradas: ${error.message}`);
  return data as UserSettings;
}

async function loadLinks(userId: string, sourceProvider: Provider): Promise<Map<string, EventLink>> {
  const { data, error } = await db()
    .from("event_links")
    .select("id,source_provider,source_event_id,target_provider,target_event_id,content_hash,source_start")
    .eq("user_id", userId)
    .eq("source_provider", sourceProvider);
  if (error) throw new Error(error.message);
  return new Map((data as EventLink[]).map((l) => [l.source_event_id, l]));
}

/** Ids de eventos que o sistema criou no provedor indicado (são cópias e nunca podem ser origem). */
async function loadCopyIds(userId: string, provider: Provider): Promise<Set<string>> {
  const { data, error } = await db()
    .from("event_links")
    .select("target_event_id")
    .eq("user_id", userId)
    .eq("target_provider", provider);
  if (error) throw new Error(error.message);
  return new Set((data as { target_event_id: string }[]).map((r) => r.target_event_id));
}

export async function createContext(userId: string, from: Provider, settings: UserSettings): Promise<SyncContext> {
  const [source, target, links, copyIdsInSource] = await Promise.all([
    adapterFor(userId, from),
    adapterFor(userId, other(from)),
    loadLinks(userId, from),
    loadCopyIds(userId, from),
  ]);
  const direction = directionOf(from);
  return {
    userId,
    settings,
    source,
    target,
    direction,
    copyIdsInSource,
    links,
    result: { direction, created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: 0, errors: 0 },
  };
}

/** Apaga a cópia ligada a um evento de origem (se existir). Só mexe em eventos criados pelo sistema. */
export async function removeCopy(ctx: SyncContext, sourceId: string, reason: string): Promise<void> {
  const link = ctx.links.get(sourceId);
  if (!link) return;
  await ctx.target.deleteCopy(link.target_event_id);
  await db().from("event_links").delete().eq("id", link.id);
  ctx.links.delete(sourceId);
  ctx.result.deleted++;
  await logAction({ userId: ctx.userId, direction: ctx.direction, action: "deleted", sourceEventId: sourceId, message: `Cópia removida: ${reason}` });
}

/** Cria, atualiza ou remove a cópia de um evento de origem. */
export async function processSourceEvent(ctx: SyncContext, ev: NormalizedEvent): Promise<void> {
  try {
    if (ctx.copyIdsInSource.has(ev.id)) {
      ctx.result.skipped++;
      return;
    }
    const reason = skipReason(ev, env().IGNORE_OUTLOOK_DESCRIPTION_CONTAINS);
    if (reason) {
      ctx.result.skipped++;
      if (!ev.isCopy) await removeCopy(ctx, ev.id, reason);
      return;
    }

    const copy = buildCopy(ev, ctx.settings);
    const hash = contentHash(copy);
    const link = ctx.links.get(ev.id);
    const now = new Date().toISOString();

    if (link && link.content_hash === hash) {
      ctx.result.unchanged++;
      return;
    }

    if (link) {
      const ok = await ctx.target.updateCopy(link.target_event_id, copy, ev.provider, ev.id);
      if (ok) {
        await db().from("event_links").update({ content_hash: hash, source_start: startInstant(ev), updated_at: now }).eq("id", link.id);
        link.content_hash = hash;
        ctx.result.updated++;
        await logAction({ userId: ctx.userId, direction: ctx.direction, action: "updated", sourceEventId: ev.id, message: copy.title });
        return;
      }
      // A cópia foi apagada à mão no destino: recria.
      await db().from("event_links").delete().eq("id", link.id);
      ctx.links.delete(ev.id);
    }

    const targetId = await ctx.target.createCopy(copy, ev.provider, ev.id);
    const { data, error } = await db()
      .from("event_links")
      .upsert(
        {
          user_id: ctx.userId,
          source_provider: ev.provider,
          source_event_id: ev.id,
          target_provider: ctx.target.provider,
          target_event_id: targetId,
          content_hash: hash,
          source_start: startInstant(ev),
          updated_at: now,
        },
        { onConflict: "user_id,source_provider,source_event_id" },
      )
      .select("id,source_provider,source_event_id,target_provider,target_event_id,content_hash,source_start")
      .single();
    if (error) {
      // Não conseguimos registrar a ligação: desfaz a cópia para não deixar órfã.
      await ctx.target.deleteCopy(targetId).catch(() => undefined);
      throw new Error(`Falha ao salvar ligação: ${error.message}`);
    }
    ctx.links.set(ev.id, data as EventLink);
    ctx.result.created++;
    await logAction({ userId: ctx.userId, direction: ctx.direction, action: "created", sourceEventId: ev.id, message: copy.title });
  } catch (err) {
    ctx.result.errors++;
    await logAction({ userId: ctx.userId, direction: ctx.direction, action: "error", sourceEventId: ev.id, message: errorMessage(err) });
  }
}

/**
 * Ressincronização completa de um sentido dentro da janela (7 dias atrás até 180 à frente).
 * Devolve o syncToken do Google quando a origem é o Google (usado na Etapa 4).
 */
export async function fullSyncDirection(userId: string, from: Provider, settings: UserSettings): Promise<DirectionResult> {
  const ctx = await createContext(userId, from, settings);
  const { start, end } = syncWindow();
  const { events } = await ctx.source.listWindow(start, end);

  const seen = new Set<string>();
  for (const ev of events) {
    seen.add(ev.id);
    await processSourceEvent(ctx, ev);
  }

  // Eventos de origem que sumiram da janela (foram excluídos): remove as cópias.
  for (const [sourceId, link] of [...ctx.links]) {
    if (seen.has(sourceId)) continue;
    const s = link.source_start ? new Date(link.source_start) : null;
    if (s && (s < start || s > end)) continue; // saiu da janela por tempo, não por exclusão
    try {
      await removeCopy(ctx, sourceId, "evento original excluído");
    } catch (err) {
      ctx.result.errors++;
      await logAction({ userId, direction: ctx.direction, action: "error", sourceEventId: sourceId, message: errorMessage(err) });
    }
  }

  await db()
    .from("sync_state")
    .upsert({ user_id: userId, provider: from, last_synced_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
  return ctx.result;
}

/** "Sincronizar agora": os dois sentidos, respeitando o que está ligado no painel. */
export async function fullSyncUser(userId: string): Promise<DirectionResult[]> {
  const settings = await loadSettings(userId);
  const results: DirectionResult[] = [];
  if (settings.outlook_to_google) results.push(await fullSyncDirection(userId, "microsoft", settings));
  if (settings.google_to_outlook) results.push(await fullSyncDirection(userId, "google", settings));
  return results;
}
