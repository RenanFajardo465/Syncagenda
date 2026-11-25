import { z } from "zod";

const base64Key32 = z
  .string()
  .min(1)
  .refine((v) => Buffer.from(v, "base64").length === 32, {
    message: "precisa ser 32 bytes em base64 (gere com: npm run gen:secret)",
  });

const EnvSchema = z.object({
  APP_BASE_URL: z.url(),
  ALLOWED_EMAILS: z.string().min(3),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: base64Key32,
  CRON_SECRET: z.string().min(16),
  MS_TENANT_ID: z.string().min(1),
  MS_CLIENT_ID: z.string().min(1),
  MS_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  IGNORE_OUTLOOK_DESCRIPTION_CONTAINS: z.string().optional().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Lê e valida as variáveis de ambiente. Só pode ser usado no servidor. */
export function env(): Env {
  if (typeof window !== "undefined") throw new Error("env() é só para o servidor");
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n- ${fields.join("\n- ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Retorna os nomes das variáveis faltando ou inválidas, sem expor valores. */
export function checkEnv(): { ok: boolean; missing: string[] } {
  const parsed = EnvSchema.safeParse(process.env);
  if (parsed.success) return { ok: true, missing: [] };
  const missing = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  return { ok: false, missing };
}

/** Lista de e-mails autorizados, em minúsculas. */
export function allowedEmails(): string[] {
  return env()
    .ALLOWED_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
