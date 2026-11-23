-- Sprint 15 — Funil padrão enxuto para contas novas.
-- Conta nova passa a nascer com: Lead, Contato realizado, Fechamento e Perdido
-- (o cliente adiciona mais etapas se quiser). Contas que já existem NÃO mudam.
-- Rode no SQL Editor do Supabase (banco que já tem o schema.sql aplicado).
-- Mesma assinatura de antes: o Hub continua chamando seed_workspace_defaults(p_ws).

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

  -- Funil padrão enxuto: o cliente adiciona mais etapas se quiser (aba Funil → Etapas).
  insert into public.crm_stages (workspace_id, pipeline_id, name, position, color, kind, role) values
    (p_ws, pid, 'Lead',              0, '#64748B', 'open', 'lead'),
    (p_ws, pid, 'Contato realizado', 1, '#EAB308', 'open', 'contato'),
    (p_ws, pid, 'Fechamento',        2, '#16A34A', 'won',  null),
    (p_ws, pid, 'Perdido',           3, '#EF4444', 'lost', null);

  -- Follow-up a cada 3 dias enquanto o lead está em "Contato realizado" (meta de 5 por dia).
  insert into public.crm_followup_rules (workspace_id, stage_id, task_type, interval_days, repeat, daily_goal)
  select p_ws, id, 'follow_up', 3, true, 5
    from public.crm_stages
   where workspace_id = p_ws and role = 'contato';

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
