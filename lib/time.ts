/** Converte uma data/hora "de parede" (sem fuso) em um instante, para um fuso IANA. */
export function localToInstant(local: string, timeZone: string): Date {
  const clean = local.replace(/\.\d+$/, "");
  const asUtc = new Date(`${clean}Z`);
  // Descobre o deslocamento do fuso nesse instante e corrige.
  const offsetMs = tzOffsetMs(asUtc, timeZone);
  return new Date(asUtc.getTime() - offsetMs);
}

/** Deslocamento (ms) do fuso em relação a UTC num dado instante. Ex.: São Paulo = -3h. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante → data/hora "de parede" no fuso (formato YYYY-MM-DDTHH:mm:ss). */
export function instantToLocal(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + tzOffsetMs(date, timeZone));
  return shifted.toISOString().slice(0, 19);
}

/** Converte HTML simples em texto (descrições do Google às vezes vêm em HTML). */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";
  if (!/<[a-z][\s\S]*>/i.test(input)) return input.trim();
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) =>
      text.trim() && text.trim() !== href ? `${text} (${href})` : href,
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
