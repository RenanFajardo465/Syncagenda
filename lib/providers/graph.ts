import "server-only";
import { fetchJson, fetchWithRetry, HttpError } from "@/lib/http";
import {
  OUTLOOK_PROP_SOURCE_ID,
  OUTLOOK_PROP_SYNC_COPY,
  TIMEZONE_IANA,
  TIMEZONE_WINDOWS,
} from "@/lib/config";
import { instantToLocal, localToInstant } from "@/lib/time";
import type { CopyContent, NormalizedEvent } from "@/lib/sync/model";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type GraphEvent = {
  id: string;
  subject?: string | null;
  body?: { contentType: string; content: string } | null;
  bodyPreview?: string | null;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  location?: { displayName?: string | null } | null;
  showAs?: string;
  responseStatus?: { response?: string } | null;
  onlineMeeting?: { joinUrl?: string | null } | null;
  onlineMeetingUrl?: string | null;
  type?: string;
  singleValueExtendedProperties?: { id: string; value: string }[];
  "@removed"?: { reason: string };
};

const SELECT = [
  "id",
  "subject",
  "body",
  "start",
  "end",
  "isAllDay",
  "isCancelled",
  "location",
  "showAs",
  "responseStatus",
  "onlineMeeting",
  "onlineMeetingUrl",
  "type",
].join(",");

const EXPAND = `singleValueExtendedProperties($filter=id eq '${OUTLOOK_PROP_SYNC_COPY}' or id eq '${OUTLOOK_PROP_SOURCE_ID}')`;

/** Cabeçalhos: horários no fuso de São Paulo e corpo em texto simples. */
export function graphHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: `outlook.timezone="${TIMEZONE_WINDOWS}", outlook.body-content-type="text"`,
  };
}

/** Lista as ocorrências individuais (calendarView) dentro da janela. */
export async function listCalendarView(token: string, start: Date, end: Date): Promise<GraphEvent[]> {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: SELECT,
    $expand: EXPAND,
    $top: "200",
  });
  let url: string | undefined = `${GRAPH}/me/calendarView?${params}`;
  const out: GraphEvent[] = [];
  while (url) {
    const page: { value: GraphEvent[]; "@odata.nextLink"?: string } = await fetchJson(url, { headers: graphHeaders(token) });
    out.push(...page.value);
    url = page["@odata.nextLink"];
  }
  return out;
}

export async function getGraphEvent(token: string, id: string): Promise<GraphEvent | null> {
  const params = new URLSearchParams({ $select: SELECT, $expand: EXPAND });
  try {
    return await fetchJson<GraphEvent>(`${GRAPH}/me/events/${encodeURIComponent(id)}?${params}`, { headers: graphHeaders(token) });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

function prop(ev: GraphEvent, id: string): string | undefined {
  return ev.singleValueExtendedProperties?.find((p) => p.id.toLowerCase() === id.toLowerCase())?.value;
}

export function normalizeGraphEvent(ev: GraphEvent): NormalizedEvent {
  const isAllDay = Boolean(ev.isAllDay);
  const startLocal = ev.start?.dateTime ?? "";
  const endLocal = ev.end?.dateTime ?? "";
  const description = ev.body?.content?.trim() ?? "";
  return {
    provider: "microsoft",
    id: ev.id,
    title: ev.subject?.trim() || "(sem título)",
    description,
    location: ev.location?.displayName?.trim() ?? "",
    isAllDay,
    start: isAllDay ? startLocal.slice(0, 10) : localToInstant(startLocal, TIMEZONE_IANA).toISOString(),
    end: isAllDay ? endLocal.slice(0, 10) : localToInstant(endLocal, TIMEZONE_IANA).toISOString(),
    busy: ev.showAs === "free" ? "free" : "busy",
    meetingUrl: ev.onlineMeeting?.joinUrl || ev.onlineMeetingUrl || null,
    declined: ev.responseStatus?.response === "declined",
    cancelled: Boolean(ev.isCancelled),
    isCopy: prop(ev, OUTLOOK_PROP_SYNC_COPY) === "1",
    rawDescription: description,
    ignorable: ev.type === "seriesMaster",
  };
}

function toGraphBody(c: CopyContent, sourceProvider: string, sourceId: string) {
  return {
    subject: c.title,
    body: { contentType: "text", content: c.description },
    location: { displayName: c.location },
    isAllDay: c.isAllDay,
    start: c.isAllDay
      ? { dateTime: `${c.start}T00:00:00`, timeZone: TIMEZONE_WINDOWS }
      : { dateTime: instantToLocal(new Date(c.start), TIMEZONE_IANA), timeZone: TIMEZONE_WINDOWS },
    end: c.isAllDay
      ? { dateTime: `${c.end}T00:00:00`, timeZone: TIMEZONE_WINDOWS }
      : { dateTime: instantToLocal(new Date(c.end), TIMEZONE_IANA), timeZone: TIMEZONE_WINDOWS },
    showAs: c.busy === "free" ? "free" : "busy",
    // Regra crítica: NUNCA enviar participantes. A cópia não gera convite para ninguém.
    responseRequested: false,
    isOnlineMeeting: false,
    singleValueExtendedProperties: [
      { id: OUTLOOK_PROP_SYNC_COPY, value: "1" },
      { id: OUTLOOK_PROP_SOURCE_ID, value: `${sourceProvider}:${sourceId}` },
    ],
  };
}

export async function createGraphCopy(token: string, c: CopyContent, sourceProvider: string, sourceId: string): Promise<string> {
  const created = await fetchJson<{ id: string }>(`${GRAPH}/me/events`, {
    method: "POST",
    headers: graphHeaders(token),
    body: JSON.stringify(toGraphBody(c, sourceProvider, sourceId)),
  });
  return created.id;
}

/** Atualiza uma cópia. Devolve false se a cópia não existe mais (foi apagada à mão). */
export async function updateGraphCopy(token: string, id: string, c: CopyContent, sourceProvider: string, sourceId: string): Promise<boolean> {
  try {
    await fetchJson(`${GRAPH}/me/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: graphHeaders(token),
      body: JSON.stringify(toGraphBody(c, sourceProvider, sourceId)),
    });
    return true;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return false;
    throw err;
  }
}

export async function deleteGraphCopy(token: string, id: string): Promise<void> {
  const res = await fetchWithRetry(`${GRAPH}/me/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: graphHeaders(token),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new HttpError(res.status, await res.text());
}
