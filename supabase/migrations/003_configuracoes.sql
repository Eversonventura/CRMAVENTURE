-- Sprint 14 — Configurações do CRM (modelo comercial e segmento).
-- Rode no SQL Editor do Supabase (banco que já tem o schema.sql aplicado).

-- Configurações do CRM da conta: modelo comercial e segmento do negócio.
create table public.crm_settings (
  workspace_id uuid primary key default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  business_model text not null default 'b2b' check (business_model in ('b2b', 'b2c')),
  segment text,
  updated_at timestamptz not null default now()
);

alter table public.crm_settings enable row level security;
create policy "crm_settings: leitura" on public.crm_settings
  for select using (workspace_id = public.active_workspace_id());
create policy "crm_settings: administrador gerencia" on public.crm_settings
  for all using (workspace_id = public.active_workspace_id() and public.is_ws_admin())
  with check (workspace_id = public.active_workspace_id() and public.is_ws_admin());

-- Contas que já existem mantêm o comportamento de hoje (B2B com redes sociais e site): segmento "agência de marketing".
insert into public.crm_settings (workspace_id, business_model, segment)
select id, 'b2b', 'agencia_marketing' from public.workspaces
on conflict (workspace_id) do nothing;

-- Conta nova (criada pelo Hub ou pelo cadastro) ganha a linha de configurações.
create or replace function public.seed_workspace_defaults(p_ws uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  -- Modelo comercial e segmento começam sem definição (B2B); o administrador ajusta em Configurações.
  insert into public.crm_settings (workspace_id, business_model, segment)
  values (p_ws, 'b2b', null)
  on conflict (workspace_id) do nothing;

  insert into public.crm_pipelines (workspace_id, name, position)
  values (p_ws, 'Comercial', 0)
  returning id into pid;

  insert into public.crm_stages (workspace_id, pipeline_id, name, position, color, kind, role) values
    (p_ws, pid, 'Novo lead',             0, '#64748B', 'open', 'lead'),
    (p_ws, pid, 'Tentativa de contato',  1, '#F97316', 'open', 'tentativa'),
    (p_ws, pid, 'Contato realizado',     2, '#EAB308', 'open', 'contato'),
    (p_ws, pid, 'Stand-by',              3, '#38BDF8', 'open', 'standby'),
    (p_ws, pid, 'Pré-briefing agendado', 4, '#84CC16', 'open', 'briefing'),
    (p_ws, pid, 'Pré-briefing realizado',5, '#22C55E', 'open', 'briefing'),
    (p_ws, pid, 'Diagnóstico agendado',  6, '#14B8A6', 'open', null),
    (p_ws, pid, 'Diagnóstico realizado', 7, '#06B6D4', 'open', 'diagnostico_proposta'),
    (p_ws, pid, 'Proposta apresentada',  8, '#3B82F6', 'open', 'diagnostico_proposta'),
    (p_ws, pid, 'Negociação',            9, '#8B5CF6', 'open', 'negociacao'),
    (p_ws, pid, 'Fechado',              10, '#16A34A', 'won',  null),
    (p_ws, pid, 'Perdido',              11, '#EF4444', 'lost', null);

  -- tentativa 7d, contato 3d, stand-by 7d, pré-briefing 2d (meta 5/dia cada)
  insert into public.crm_followup_rules (workspace_id, stage_id, task_type, interval_days, repeat, daily_goal)
  select p_ws, id, 'follow_up',
         case role when 'tentativa' then 7 when 'standby' then 7 when 'contato' then 3 else 2 end,
         true, 5
    from public.crm_stages
   where workspace_id = p_ws and role in ('tentativa', 'contato', 'standby', 'briefing');

  insert into public.crm_followup_rules (workspace_id, stage_id, task_type, interval_days, repeat, daily_goal)
  select p_ws, id, 'preparar_proposta', 2, false, null
    from public.crm_stages
   where workspace_id = p_ws and role = 'diagnostico_proposta'
   order by position
   limit 1;

  -- Valores iniciais: ajuste em CRM → Visão geral → Metas.
  insert into public.crm_goals (workspace_id, metric, owner_id, target, direction) values
    (p_ws, 'daily_approaches', null, 10, 'higher'),
    (p_ws, 'leads_recebidos', null, 60, 'higher'),
    (p_ws, 'reunioes_realizadas', null, 8, 'higher'),
    (p_ws, 'propostas_apresentadas', null, 6, 'higher'),
    (p_ws, 'fechamentos', null, 3, 'higher'),
    (p_ws, 'receita_fechada', null, 15000, 'higher'),
    (p_ws, 'taxa_conversao', null, 30, 'higher'),
    (p_ws, 'ticket_medio', null, 3000, 'higher'),
    (p_ws, 'tempo_medio_fechar', null, 30, 'lower'),
    (p_ws, 'tarefas_atrasadas', null, 5, 'lower'),
    (p_ws, 'olympic_base', null, 3000, 'higher'),
    (p_ws, 'olympic_inflation', null, 4.5, 'higher'),
    (p_ws, 'olympic_bronze', null, 15, 'higher'),
    (p_ws, 'olympic_silver', null, 25, 'higher'),
    (p_ws, 'olympic_gold', null, 35, 'higher'),
    (p_ws, 'rmv_multiplier', null, 2, 'higher'),
    (p_ws, 'rmv_manual', null, 0, 'higher');
end;
$$;
