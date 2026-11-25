import "server-only";
import { fetchJson, fetchWithRetry, HttpError } from "@/lib/http";
import { TIMEZONE_IANA } from "@/lib/config";
import { htmlToText } from "@/lib/time";
import type { CopyContent, NormalizedEvent } from "@/lib/sync/model";

const API = "https://www.googleapis.com/calendar/v3";

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  transparency?: "opaque" | "transparent";
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
  attendees?: { self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
  eventType?: string;
};

type ListResponse = { items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
const calPath = (calendarId: string) => `${API}/calendars/${encodeURIComponent(calendarId)}/events`;

/** Lista eventos (ocorrências individuais) na janela. Devolve também o syncToken para a etapa incremental. */
export async function listGoogleEvents(
  token: string,
  calendarId: string,
  start: Date,
  end: Date,
): Promise<{ items: GoogleEvent[]; nextSyncToken?: string }> {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const p = new URLSearchParams({
      singleEvents: "true",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: "250",
      showDeleted: "false",
    });
    if (pageToken) p.set("pageToken", pageToken);
    const page = await fetchJson<ListResponse>(`${calPath(calendarId)}?${p}`, { headers: headers(token) });
    items.push(...page.items);
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  return { items, nextSyncToken };
}

export function googleMeetingUrl(ev: GoogleEvent): string | null {
  return ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || null;
}

export function normalizeGoogleEvent(ev: GoogleEvent): NormalizedEvent {
  const isAllDay = Boolean(ev.start?.date);
  const description = htmlToText(ev.description);
  const priv = ev.extendedProperties?.private ?? {};
  return {
    provider: "google",
    id: ev.id,
    title: ev.summary?.trim() || "(sem título)",
    description,
    location: ev.location?.trim() ?? "",
    isAllDay,
    start: isAllDay ? ev.start!.date! : new Date(ev.start?.dateTime ?? 0).toISOString(),
    end: isAllDay ? ev.end!.date! : new Date(ev.end?.dateTime ?? 0).toISOString(),
    busy: ev.transparency === "transparent" ? "free" : "busy",
    meetingUrl: googleMeetingUrl(ev),
    declined: Boolean(ev.attendees?.some((a) => a.self && a.responseStatus === "declined")),
    cancelled: ev.status === "cancelled",
    isCopy: priv.syncCopy === "1",
    rawDescription: ev.description ?? "",
    ignorable: ev.eventType === "workingLocation" || ev.eventType === "birthday" || ev.eventType === "fromGmail",
  };
}

function toGoogleBody(c: CopyContent, sourceProvider: string, sourceId: string) {
  return {
    summary: c.title,
    description: c.description,
    location: c.location,
    start: c.isAllDay ? { date: c.start } : { dateTime: c.start, timeZone: TIMEZONE_IANA },
    end: c.isAllDay ? { date: c.end } : { dateTime: c.end, timeZone: TIMEZONE_IANA },
    transparency: c.busy === "free" ? "transparent" : "opaque",
    // Regra crítica: sem participantes; marcação de cópia para nunca voltar.
    attendees: [],
    guestsCanInviteOthers: false,
    extendedProperties: { private: { syncCopy: "1", sourceProvider, sourceId } },
  };
}

// Regra crítica: sendUpdates=none em toda escrita no Google.
const NO_UPDATES = "sendUpdates=none";

export async function createGoogleCopy(token: string, calendarId: string, c: CopyContent, sourceProvider: string, sourceId: string): Promise<string> {
  const created = await fetchJson<{ id: string }>(`${calPath(calendarId)}?${NO_UPDATES}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(toGoogleBody(c, sourceProvider, sourceId)),
  });
  return created.id;
}

/** Atualiza uma cópia. Devolve false se ela não existe mais. */
export async function updateGoogleCopy(token: string, calendarId: string, id: string, c: CopyContent, sourceProvider: string, sourceId: string): Promise<boolean> {
  try {
    const current = await fetchJson<GoogleEvent>(`${calPath(calendarId)}/${encodeURIComponent(id)}`, { headers: headers(token) });
    if (current.status === "cancelled") return false;
    await fetchJson(`${calPath(calendarId)}/${encodeURIComponent(id)}?${NO_UPDATES}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(toGoogleBody(c, sourceProvider, sourceId)),
    });
    return true;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 410)) return false;
    throw err;
  }
}

export async function deleteGoogleCopy(token: string, calendarId: string, id: string): Promise<void> {
  const res = await fetchWithRetry(`${calPath(calendarId)}/${encodeURIComponent(id)}?${NO_UPDATES}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new HttpError(res.status, await res.text());
}
