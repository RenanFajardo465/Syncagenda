-- Sync Agendas: estrutura inicial do banco.
-- Todas as tabelas têm RLS ligado e NENHUMA policy pública:
-- só o servidor (service role key) consegue ler e gravar.

create extension if not exists pgcrypto;

-- Usuários do painel (login Microsoft)
create table public.app_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now()
);

-- Contas conectadas (Microsoft e Google). Tokens sempre criptografados (AES-256-GCM).
create table public.connections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.app_users(id) on delete cascade,
  provider           text not null check (provider in ('microsoft', 'google')),
  account_email      text,
  calendar_id        text not null default 'primary',
  refresh_token_enc  text,
  access_token_enc   text,
  expires_at         timestamptz,
  status             text not null default 'ok' check (status in ('ok', 'error', 'needs_reconnect')),
  last_error         text,
  updated_at         timestamptz not null default now(),
  unique (user_id, provider)
);

-- Preferências de cada usuário
create table public.user_settings (
  user_id               uuid primary key references public.app_users(id) on delete cascade,
  outlook_to_google     boolean not null default true,
  google_to_outlook     boolean not null default true,
  privacy_mode          text not null default 'full' check (privacy_mode in ('full', 'busy')),
  title_prefix_outlook  text not null default '',  -- prefixo nas cópias criadas no Outlook (vindas do Google)
  title_prefix_google   text not null default '',  -- prefixo nas cópias criadas no Google (vindas do Outlook)
  updated_at            timestamptz not null default now()
);

-- Assinaturas de notificação (Graph subscription / Google watch channel)
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.app_users(id) on delete cascade,
  provider               text not null check (provider in ('microsoft', 'google')),
  external_id            text not null,       -- subscription id (Graph) ou channel id (Google)
  resource_id            text,                -- resourceId do Google
  client_state_or_token  text not null,       -- segredo validado no webhook
  expires_at             timestamptz not null,
  created_at             timestamptz not null default now(),
  unique (provider, external_id)
);
create index subscriptions_expires_idx on public.subscriptions (expires_at);

-- Estado da sincronização incremental (deltaLink do Graph / syncToken do Google)
create table public.sync_state (
  user_id                   uuid not null references public.app_users(id) on delete cascade,
  provider                  text not null check (provider in ('microsoft', 'google')),
  delta_link_or_sync_token  text,
  last_synced_at            timestamptz,
  primary key (user_id, provider)
);

-- Ligação entre evento original e a cópia criada pelo sistema
create table public.event_links (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.app_users(id) on delete cascade,
  source_provider   text not null check (source_provider in ('microsoft', 'google')),
  source_event_id   text not null,
  target_provider   text not null check (target_provider in ('microsoft', 'google')),
  target_event_id   text not null,
  content_hash      text not null,
  updated_at        timestamptz not null default now(),
  unique (user_id, source_provider, source_event_id)
);
create index event_links_target_idx on public.event_links (user_id, target_provider, target_event_id);

-- Histórico de ações (o painel mostra as últimas 50)
create table public.sync_log (
  id               bigint generated always as identity primary key,
  user_id          uuid references public.app_users(id) on delete cascade,
  direction        text check (direction in ('outlook_to_google', 'google_to_outlook', 'system')),
  action           text not null check (action in ('created', 'updated', 'deleted', 'skipped', 'error', 'info')),
  source_event_id  text,
  message          text,
  created_at       timestamptz not null default now()
);
create index sync_log_user_created_idx on public.sync_log (user_id, created_at desc);

-- RLS ligado em tudo, sem policies (bloqueia anon e authenticated).
alter table public.app_users      enable row level security;
alter table public.connections    enable row level security;
alter table public.user_settings  enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.sync_state     enable row level security;
alter table public.event_links    enable row level security;
alter table public.sync_log       enable row level security;

-- Garantia extra: tira qualquer permissão das roles públicas.
revoke all on all tables in schema public from anon, authenticated;
