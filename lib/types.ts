export type Provider = "microsoft" | "google";
export type Direction = "outlook_to_google" | "google_to_outlook" | "system";
export type LogAction = "created" | "updated" | "deleted" | "skipped" | "error" | "info";
export type ConnectionStatus = "ok" | "error" | "needs_reconnect";

export type ConnectionRow = {
  id: string;
  user_id: string;
  provider: Provider;
  account_email: string | null;
  calendar_id: string;
  refresh_token_enc: string | null;
  access_token_enc: string | null;
  expires_at: string | null;
  status: ConnectionStatus;
  last_error: string | null;
  updated_at: string;
};

export type UserSettings = {
  user_id: string;
  outlook_to_google: boolean;
  google_to_outlook: boolean;
  privacy_mode: "full" | "busy";
  title_prefix_outlook: string;
  title_prefix_google: string;
};
