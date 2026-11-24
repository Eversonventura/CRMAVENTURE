-- Sprint 33 — Origens (canais de aquisição) personalizáveis por conta.
-- Cada negócio tem os próprios canais: o administrador adiciona, remove e marca quais são de anúncio
-- (as marcadas alimentam "Responder leads de anúncio" e a meta de leads de anúncio).
-- Conta sem linhas nesta tabela continua usando a lista padrão do sistema. Leads antigos mantêm a origem que já têm.
-- Rode no SQL Editor do Supabase.

create table public.crm_acquisition_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_ad boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table public.crm_acquisition_channels enable row level security;
create policy "crm_acquisition_channels: leitura" on public.crm_acquisition_channels
  for select using (workspace_id = public.active_workspace_id());
create policy "crm_acquisition_channels: administrador gerencia" on public.crm_acquisition_channels
  for all using (workspace_id = public.active_workspace_id() and public.is_ws_admin())
  with check (workspace_id = public.active_workspace_id() and public.is_ws_admin());
