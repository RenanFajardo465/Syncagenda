import { normalizeGraphEvent } from "../lib/providers/graph";
import { normalizeGoogleEvent } from "../lib/providers/gcal";
import { buildCopy, skipReason, contentHash } from "../lib/sync/mapping";
import { instantToLocal, localToInstant, htmlToText } from "../lib/time";
import { startInstant } from "../lib/sync/model";
import { test } from "node:test";
import { ok } from "node:assert/strict";
const assert = (c: boolean, m: string) => ok(c, m);
test("mapeamento de eventos e regras críticas", () => {
const settings: any = { privacy_mode: "full", title_prefix_google: "[Teams]", title_prefix_outlook: "", outlook_to_google: true, google_to_outlook: true };

const g = normalizeGraphEvent({ id: "o1", subject: "Reunião", body: { contentType: "text", content: "pauta" }, start: { dateTime: "2026-11-26T10:00:00.0000000", timeZone: "E. South America Standard Time" }, end: { dateTime: "2026-11-26T11:00:00.0000000", timeZone: "x" }, isAllDay: false, showAs: "tentative", onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/abc" }, responseStatus: { response: "accepted" } });
assert(g.start === "2026-11-26T13:00:00.000Z", "Outlook 10h SP = 13h UTC: " + g.start);
const c = buildCopy(g, settings);
assert(c.title === "[Teams] Reunião", "prefixo: " + c.title);
assert(c.location === "https://teams.microsoft.com/l/abc", "local = link Teams");
assert(c.description.startsWith("Microsoft Teams: https://teams"), "descrição começa com link");
assert(c.busy === "busy", "tentative -> busy");

const allDay = normalizeGraphEvent({ id: "o2", subject: "Feriado", start: { dateTime: "2026-12-25T00:00:00.0000000", timeZone: "x" }, end: { dateTime: "2026-12-26T00:00:00.0000000", timeZone: "x" }, isAllDay: true, showAs: "free" });
assert(allDay.start === "2026-12-25" && allDay.end === "2026-12-26" && allDay.busy === "free", "dia inteiro + livre");
assert(startInstant(allDay) === "2026-12-25T03:00:00.000Z", "início dia inteiro: " + startInstant(allDay));

const zap = normalizeGraphEvent({ id: "o3", subject: "x", body: { contentType: "text", content: "... Agendado via Calendly ..." }, start: { dateTime: "2026-11-26T10:00:00", timeZone: "" }, end: { dateTime: "2026-11-26T11:00:00", timeZone: "" } });
assert(skipReason(zap, "Agendado via Calendly")?.includes("Zapier") === true, "ignora cópia do Zapier");
const declined = normalizeGraphEvent({ id: "o4", responseStatus: { response: "declined" }, start: { dateTime: "2026-11-26T10:00:00", timeZone: "" }, end: { dateTime: "2026-11-26T11:00:00", timeZone: "" } });
assert(skipReason(declined, "") === "evento recusado", "recusado não copia");
const copyO = normalizeGraphEvent({ id: "o5", start: { dateTime: "2026-11-26T10:00:00", timeZone: "" }, end: { dateTime: "2026-11-26T11:00:00", timeZone: "" }, singleValueExtendedProperties: [{ id: "String {6b0f3c52-8d7e-4a51-9b1d-5c2f0e7a9d14} Name syncCopy", value: "1" }] });
assert(copyO.isCopy && skipReason(copyO, "") !== null, "cópia no Outlook não volta");

const ge = normalizeGoogleEvent({ id: "g1", summary: "Calendly: TOTVS", description: "<p>Olá<br>linha2</p>", start: { dateTime: "2026-11-27T14:00:00-03:00" }, end: { dateTime: "2026-11-27T14:30:00-03:00" }, hangoutLink: "https://meet.google.com/aaa-bbbb-ccc", attendees: [{ self: true, responseStatus: "accepted" }] });
const gc = buildCopy(ge, settings);
assert(gc.title === "Calendly: TOTVS", "sem prefixo no Outlook");
assert(gc.location === "https://meet.google.com/aaa-bbbb-ccc" && gc.description === "Google Meet: https://meet.google.com/aaa-bbbb-ccc\n\nOlá\nlinha2", "Meet no local e descrição: " + JSON.stringify(gc.description));
assert(instantToLocal(new Date(gc.start), "America/Sao_Paulo") === "2026-11-27T14:00:00", "volta para 14h local");
const gcopy = normalizeGoogleEvent({ id: "g2", start: { date: "2026-11-27" }, end: { date: "2026-11-28" }, extendedProperties: { private: { syncCopy: "1" } } });
assert(gcopy.isCopy, "cópia no Google detectada");
const gdecl = normalizeGoogleEvent({ id: "g3", start: { date: "2026-11-27" }, end: { date: "2026-11-28" }, attendees: [{ self: true, responseStatus: "declined" }] });
assert(gdecl.declined, "recusado no Google");
const busy = buildCopy(ge, { ...settings, privacy_mode: "busy" });
assert(busy.title === "Ocupado" && !busy.description && !busy.location, "modo apenas Ocupado");
assert(contentHash(gc) === contentHash(buildCopy(ge, settings)) && contentHash(gc) !== contentHash(busy), "hash estável");
assert(localToInstant("2026-11-26T00:00:00", "America/Sao_Paulo").toISOString() === "2026-11-26T03:00:00.000Z", "localToInstant");
});
