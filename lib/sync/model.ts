import type { Provider } from "@/lib/types";
import { TIMEZONE_IANA } from "@/lib/config";
import { localToInstant } from "@/lib/time";

/** Evento num formato neutro, independente de Outlook ou Google. */
export type NormalizedEvent = {
  provider: Provider;
  id: string;
  title: string;
  description: string; // texto simples
  location: string;
  isAllDay: boolean;
  /** Dia inteiro: datas YYYY-MM-DD (fim exclusivo). Com horário: instantes ISO (UTC). */
  start: string;
  end: string;
  busy: "busy" | "free";
  meetingUrl: string | null;
  declined: boolean;
  cancelled: boolean;
  /** true se é uma cópia criada por este sistema (nunca deve ser sincronizada de volta). */
  isCopy: boolean;
  /** Texto bruto usado no filtro de transição do Zapier. */
  rawDescription: string;
  /** Tipos que não devem ser copiados (ex.: aniversários, local de trabalho). */
  ignorable: boolean;
};

/** Conteúdo que será gravado na cópia. */
export type CopyContent = {
  title: string;
  description: string;
  location: string;
  isAllDay: boolean;
  start: string;
  end: string;
  busy: "busy" | "free";
};

/** Instante de início (para guardar em event_links.source_start). */
export function startInstant(ev: NormalizedEvent): string {
  return ev.isAllDay ? localToInstant(`${ev.start}T00:00:00`, TIMEZONE_IANA).toISOString() : ev.start;
}
