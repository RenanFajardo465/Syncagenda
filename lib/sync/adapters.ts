import "server-only";
import { getAccessToken, getConnection } from "@/lib/connections";
import {
  createGraphCopy,
  deleteGraphCopy,
  listCalendarView,
  normalizeGraphEvent,
  updateGraphCopy,
} from "@/lib/providers/graph";
import {
  createGoogleCopy,
  deleteGoogleCopy,
  listGoogleEvents,
  normalizeGoogleEvent,
  updateGoogleCopy,
} from "@/lib/providers/gcal";
import type { Provider } from "@/lib/types";
import type { CopyContent, NormalizedEvent } from "@/lib/sync/model";

/** Interface comum para ler eventos e gravar cópias em cada provedor. */
export type Adapter = {
  provider: Provider;
  listWindow(start: Date, end: Date): Promise<{ events: NormalizedEvent[]; syncToken?: string }>;
  createCopy(c: CopyContent, sourceProvider: Provider, sourceId: string): Promise<string>;
  updateCopy(id: string, c: CopyContent, sourceProvider: Provider, sourceId: string): Promise<boolean>;
  deleteCopy(id: string): Promise<void>;
};

export async function adapterFor(userId: string, provider: Provider): Promise<Adapter> {
  const token = await getAccessToken(userId, provider);
  if (provider === "microsoft") {
    return {
      provider,
      async listWindow(start, end) {
        const raw = await listCalendarView(token, start, end);
        return { events: raw.map(normalizeGraphEvent) };
      },
      createCopy: (c, sp, sid) => createGraphCopy(token, c, sp, sid),
      updateCopy: (id, c, sp, sid) => updateGraphCopy(token, id, c, sp, sid),
      deleteCopy: (id) => deleteGraphCopy(token, id),
    };
  }
  const calendarId = (await getConnection(userId, "google"))?.calendar_id ?? "primary";
  return {
    provider,
    async listWindow(start, end) {
      const { items, nextSyncToken } = await listGoogleEvents(token, calendarId, start, end);
      return { events: items.map(normalizeGoogleEvent), syncToken: nextSyncToken };
    },
    createCopy: (c, sp, sid) => createGoogleCopy(token, calendarId, c, sp, sid),
    updateCopy: (id, c, sp, sid) => updateGoogleCopy(token, calendarId, id, c, sp, sid),
    deleteCopy: (id) => deleteGoogleCopy(token, calendarId, id),
  };
}
