-- Guarda o início do evento original, para só apagar cópias de eventos que sumiram
-- DENTRO da janela de sincronização (evita apagar cópias de eventos antigos que só saíram da janela).
alter table public.event_links add column source_start timestamptz;
create index event_links_user_source_start_idx on public.event_links (user_id, source_provider, source_start);
