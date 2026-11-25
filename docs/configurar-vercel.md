# Variáveis de ambiente no Vercel

O projeto `syncagenda` já existe no seu Vercel e algumas variáveis já foram preenchidas automaticamente:
`APP_BASE_URL`, `SUPABASE_URL`, `IGNORE_OUTLOOK_DESCRIPTION_CONTAINS`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` e `CRON_SECRET`.

Faltam **7 variáveis**, que só você pode preencher (são segredos ou dados seus).

## Onde clicar
1. Acesse <https://vercel.com> → projeto **syncagenda**.
2. Aba **Settings** → no menu da esquerda, **Environment Variables**.
3. Para cada variável abaixo: digite o nome em **Key**, cole o valor em **Value**, deixe marcados **Production** e **Preview**, ative **Sensitive** nas marcadas com 🔒 e clique em **Save**.

| Key | De onde vem o valor |
|---|---|
| `ALLOWED_EMAILS` | Os e-mails Microsoft da empresa que podem entrar, separados por vírgula. Ex.: `renan@empresa.com.br,leonardo@empresa.com.br` |
| `MS_TENANT_ID` | Enviado pelo administrador ("ID do diretório (locatário)") |
| `MS_CLIENT_ID` | Enviado pelo administrador ("ID do aplicativo (cliente)") |
| `MS_CLIENT_SECRET` 🔒 | Enviado pelo administrador ("Valor do segredo") |
| `GOOGLE_CLIENT_ID` | Google Cloud → Credenciais → `syncagenda` → "ID do cliente" |
| `GOOGLE_CLIENT_SECRET` 🔒 | Google Cloud → Credenciais → `syncagenda` → "Chave secreta do cliente" |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | Veja abaixo |

### Como pegar a `SUPABASE_SERVICE_ROLE_KEY`
1. Acesse <https://supabase.com/dashboard> → projeto **syncagenda**.
2. Engrenagem **Project Settings** → **API Keys**.
3. Na parte de chaves secretas, copie a chave **`service_role`** (ou a **secret key**, que começa com `sb_secret_`). Clique em **Reveal** e depois em copiar.
4. Essa chave dá acesso total ao banco: cole **somente** no Vercel.

## Depois de salvar tudo
1. Aba **Deployments** → no deploy mais recente, menu **⋯** → **Redeploy** → **Redeploy**. (Variáveis novas só valem a partir de um novo deploy.)
2. Para conferir: abra <https://syncagenda.vercel.app/api/health>. Se aparecer `"ok": true`, está tudo preenchido. Se aparecer `"missing": [...]`, a lista mostra o nome das variáveis que faltam (nunca os valores).
