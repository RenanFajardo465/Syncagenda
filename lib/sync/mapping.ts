import { createHash } from "node:crypto";
import { BUSY_TITLE } from "@/lib/config";
import type { UserSettings } from "@/lib/types";
import type { CopyContent, NormalizedEvent } from "@/lib/sync/model";

/** Monta o conteúdo da cópia a partir do evento original, aplicando privacidade, prefixo e link da reunião. */
export function buildCopy(src: NormalizedEvent, settings: UserSettings): CopyContent {
  const base = { isAllDay: src.isAllDay, start: src.start, end: src.end, busy: src.busy };
  if (settings.privacy_mode === "busy") {
    return { ...base, title: BUSY_TITLE, description: "", location: "" };
  }

  // Prefixo da cópia: depende de onde a cópia é criada.
  const prefix = (src.provider === "microsoft" ? settings.title_prefix_google : settings.title_prefix_outlook).trim();
  const title = prefix ? `${prefix} ${src.title}` : src.title;

  let location = src.location;
  let description = src.description;
  if (src.meetingUrl) {
    if (!location) location = src.meetingUrl;
    else if (!location.includes(src.meetingUrl)) location = `${src.meetingUrl} | ${location}`;
    const label = src.provider === "google" ? "Google Meet" : "Microsoft Teams";
    description = `${label}: ${src.meetingUrl}${description ? `\n\n${description}` : ""}`;
  }
  return { ...base, title, description: description.slice(0, 8000), location: location.slice(0, 1000) };
}

export function contentHash(c: CopyContent): string {
  return createHash("sha256").update(JSON.stringify(c)).digest("hex");
}

/** Motivo para não copiar o evento (ou null se deve copiar). */
export function skipReason(ev: NormalizedEvent, ignoreText: string): string | null {
  if (ev.isCopy) return "é uma cópia criada pelo sistema";
  if (ev.cancelled) return "evento cancelado";
  if (ev.declined) return "evento recusado";
  if (ev.ignorable) return "tipo de evento ignorado";
  if (ev.provider === "microsoft" && ignoreText && ev.rawDescription.includes(ignoreText)) {
    return `cópia antiga do Zapier ("${ignoreText}")`;
  }
  return null;
}
