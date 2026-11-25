# Sync Agendas

Sincronização **em tempo real e nos dois sentidos** entre a agenda do **Outlook/Teams (Microsoft 365)** e a **Google Agenda** de cada usuário. Substitui o Zap do Zapier que copiava reuniões do Calendly para o Outlook.

> Status: **Etapa 2 de 7** (login Microsoft e conexão Google). Este README cresce a cada etapa.

## O que o sistema faz

- Evento criado, alterado ou excluído no **Outlook** → a cópia é criada, alterada ou excluída no **Google**.
- Evento criado, alterado ou excluído no **Google** (incluindo os do Calendly, com link do Meet) → a cópia aparece no **Outlook/Teams**, marcando você como ocupado.
- As cópias **nunca** levam participantes, então ninguém recebe convite.
- As cópias são marcadas e **nunca** voltam para a origem (sem loop).
- O sistema **nunca** altera nem apaga os seus eventos originais.
- Janela: de 7 dias atrás até 180 dias à frente.

## Arquitetura

```
   Outlook / Teams                                         Google Agenda
  (Microsoft Graph)                                     (Calendar API v3)
        │  aviso de mudança (webhook)                 aviso (webhook)  │
        ▼                                                              ▼
  ┌──────────────────────────── Vercel (Next.js) ────────────────────────────┐
  │  /api/webhooks/microsoft         /api/webhooks/google                    │
  │            │  lê só o que mudou (delta / syncToken)  │                   │
  │            └──────────────►  motor de sincronização  ◄────────┘          │
  │                       cria/atualiza/apaga a CÓPIA do outro lado          │
  │  Painel (login Microsoft)   ·   cron diário: renova os avisos            │
  └──────────────────────────────────────┬───────────────────────────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  Supabase (Postgres)    │
                            │  tokens criptografados, │
                            │  ligações, log          │
                            │  pg_cron: conferência   │
                            │  a cada 10 minutos      │
                            └─────────────────────────┘
```

## Estrutura do código

| Pasta | O que tem |
|---|---|
| `app/` | Páginas do painel e rotas da API (Next.js App Router) |
| `lib/` | Código do servidor: variáveis de ambiente, banco, criptografia, Microsoft, Google, sincronização |
| `supabase/migrations/` | Scripts SQL que criam as tabelas (versionados por data) |
| `docs/` | Textos de apoio (ex.: mensagem para o administrador do Microsoft 365) |

## Variáveis de ambiente

A lista completa está em [`.env.example`](.env.example). Nunca coloque valores reais no repositório nem no chat.

### Como gerar `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` e `CRON_SECRET`

Rode este comando **três vezes** (uma para cada variável) e copie cada resultado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Rode no terminal do seu computador (no Mac: aplicativo "Terminal"). Se o Node não estiver instalado, este comando faz o mesmo no Mac e no Linux: `openssl rand -base64 32`.

> A `TOKEN_ENCRYPTION_KEY` precisa ser exatamente o formato gerado acima (32 bytes em base64). Se ela for trocada, todas as contas precisam ser conectadas de novo.

## Configurações externas (passo a passo com cliques)

1. **Microsoft Entra (Azure):** feito pelo administrador. Envie a ele o [texto pronto](docs/texto-administrador-m365.md).
2. **Google Cloud:** [guia](docs/configurar-google-cloud.md).
3. **Supabase:** o projeto `syncagenda` (região São Paulo) já foi criado e as tabelas de `supabase/migrations/` já foram aplicadas.
4. **Vercel:** o projeto `syncagenda` já está ligado a este repositório. Falta preencher as variáveis: [guia](docs/configurar-vercel.md).

## Segurança

- Login no painel só com conta Microsoft da empresa **e** e-mail listado em `ALLOWED_EMAILS`.
- Tokens da Microsoft e do Google são gravados criptografados (AES-256-GCM, chave `TOKEN_ENCRYPTION_KEY`) e nunca aparecem no log.
- Sessão do painel em cookie assinado (HMAC, chave `SESSION_SECRET`), válida por 30 dias.
- Se o acesso ao Google ou à Microsoft for revogado, a conexão fica como **"Precisa reconectar"** no painel.

## Rodar localmente (opcional, para desenvolvedores)

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # abre em http://localhost:3000
```

`GET /api/health` diz quais variáveis estão faltando, sem mostrar valores.
