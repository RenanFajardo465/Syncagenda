/** Configurações fixas da sincronização. */
export const SYNC_WINDOW_PAST_DAYS = 7;
export const SYNC_WINDOW_FUTURE_DAYS = 180;

/** Fuso usado para ler/gravar eventos. São Paulo não tem horário de verão desde 2019. */
export const TIMEZONE_IANA = "America/Sao_Paulo";
/** O mesmo fuso no formato do Windows/Outlook. */
export const TIMEZONE_WINDOWS = "E. South America Standard Time";

/** GUID próprio usado nas propriedades estendidas do Outlook (marca de cópia). */
export const OUTLOOK_PROP_GUID = "{6b0f3c52-8d7e-4a51-9b1d-5c2f0e7a9d14}";
export const OUTLOOK_PROP_SYNC_COPY = `String ${OUTLOOK_PROP_GUID} Name syncCopy`;
export const OUTLOOK_PROP_SOURCE_ID = `String ${OUTLOOK_PROP_GUID} Name sourceId`;

export const BUSY_TITLE = "Ocupado";

export function syncWindow(now = new Date()): { start: Date; end: Date } {
  const day = 24 * 60 * 60 * 1000;
  return {
    start: new Date(now.getTime() - SYNC_WINDOW_PAST_DAYS * day),
    end: new Date(now.getTime() + SYNC_WINDOW_FUTURE_DAYS * day),
  };
}
