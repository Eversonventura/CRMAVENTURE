-- Sprint 38 — Papéis do processo simplificados: Lead, Prospect, Qualificado, Desqualificado e Stand-by.
--   Lead = ainda não respondeu (inclui "Tentativa de contato"); Prospect = respondeu ("Contato realizado");
--   Qualificado = em análise, pré-briefing, proposta, negociação; Desqualificado; Stand-by = não está no momento de compra.
-- As etapas que a conta já tem são convertidas sozinhas (as regras de follow-up ficam ligadas às mesmas etapas).
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez.

alter table public.crm_stages drop constraint if exists crm_stages_role_check;

update public.crm_stages set role = case role
  when 'tentativa' then 'lead'
  when 'contato' then 'prospect'
  when 'briefing' then 'qualificado'
  when 'diagnostico_proposta' then 'qualificado'
  when 'negociacao' then 'qualificado'
  else role end
where role in ('tentativa', 'contato', 'briefing', 'diagnostico_proposta', 'negociacao');

alter table public.crm_stages add constraint crm_stages_role_check
  check (role in ('lead', 'prospect', 'qualificado', 'desqualificado', 'standby'));

-- Sair do lead (ou avançar entre etapas de lead, como "Tentativa de contato") conta como primeiro contato.
create or replace function public.crm_opportunity_lifecycle()
returns trigger
language plpgsql
as $$
declare
  old_role text;
  new_role text;
  old_pos int;
  new_pos int;
begin
  if new.status = 'fechada' and old.status is distinct from 'fechada' then
    new.closed_at := coalesce(new.closed_at, now());
  elsif new.status = 'perdida' and old.status is distinct from 'perdida' then
    new.lost_at := coalesce(new.lost_at, now());
  elsif new.status = 'aberta' and old.status is distinct from 'aberta' then
    new.closed_at := null;
    new.lost_at := null;
  end if;

  if new.stage_id is distinct from old.stage_id and new.first_contact_at is null then
    select role, position into old_role, old_pos from public.crm_stages where id = old.stage_id;
    select role, position into new_role, new_pos from public.crm_stages where id = new.stage_id;
    -- Sair do lead (ou avançar entre etapas de lead, como "Tentativa de contato") conta como primeiro contato.
    if old_role = 'lead' and (new_role is distinct from 'lead' or new_pos > old_pos) then
      new.first_contact_at := now();
    end if;
  end if;

  return new;
end;
$$;

-- Conta nova: funil padrão com o papel Prospect em "Contato realizado".
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

  perform public.seed_message_templates(p_ws);

  -- Funil padrão enxuto: o cliente adiciona mais etapas se quiser (aba Funil → Etapas).
  insert into public.crm_stages (workspace_id, pipeline_id, name, position, color, kind, role) values
    (p_ws, pid, 'Lead',              0, '#64748B', 'open', 'lead'),
    (p_ws, pid, 'Contato realizado', 1, '#EAB308', 'open', 'prospect'),
    (p_ws, pid, 'Fechamento',        2, '#16A34A', 'won',  null),
    (p_ws, pid, 'Perdido',           3, '#EF4444', 'lost', null);

  -- Follow-up a cada 3 dias enquanto o lead está em "Contato realizado" (meta de 5 por dia).
  insert into public.crm_followup_rules (workspace_id, stage_id, task_type, interval_days, repeat, daily_goal)
  select p_ws, id, 'follow_up', 3, true, 5
    from public.crm_stages
   where workspace_id = p_ws and role = 'prospect';

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
