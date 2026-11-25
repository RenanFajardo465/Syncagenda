import "server-only";

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}: ${body.slice(0, 300)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch com nova tentativa para limites de uso (429) e instabilidade (500/502/503/504),
 * respeitando Retry-After e com espera crescente.
 */
export async function fetchWithRetry(url: string, init: RequestInit = {}, maxRetries = 4): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    let retryable = res.status === 429 || (res.status >= 500 && res.status <= 504);
    // O Google também sinaliza limite de uso com 403 + rateLimitExceeded.
    if (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(await res.clone().text())) retryable = true;
    if (!retryable || attempt >= maxRetries) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
    await sleep(Math.min(wait, 20_000) + Math.random() * 250);
  }
}

/** Faz a chamada e devolve JSON; lança HttpError se não for 2xx. */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new HttpError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
