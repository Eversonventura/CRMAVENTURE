-- ============================================================================
-- CRM Aventure — schema único (rode inteiro no SQL Editor do Supabase).
--
-- Modelo de contas compartilháveis:
--   * Cada usuário que se cadastra ganha uma CONTA (workspace) própria, com
--     etapas, metas e regras padrão. Os dados ficam todos dentro da conta.
--   * O dono pode CONVIDAR outras pessoas por e-mail (papel: administrador,
--     gestor ou vendedor). Se a pessoa já tem login, entra na hora; se não,
--     o convite fica pendente e vale assim que ela se cadastrar.
--   * Um usuário pode participar de várias contas e alternar entre elas.
--
-- Isolamento: toda tabela tem workspace_id (default = conta ativa) e RLS.
-- A conta ativa vem do header `x-workspace-id` enviado pelo app; só vale se
-- o usuário for membro dela (senão cai na primeira conta dele).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Contas, membros e convites
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- "Membros da conta". Mantém o nome team_members porque o resto do sistema
-- (responsável da oportunidade, tarefa, meta…) aponta para ele.
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null default '',
  email text,
  photo_url text,
  crm_role text not null default 'vendedor'
    check (crm_role in ('administrador', 'gestor', 'vendedor')),
  created_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);
create index idx_team_members_profile on public.team_members (profile_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  crm_role text not null default 'vendedor'
    check (crm_role in ('administrador', 'gestor', 'vendedor')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- ---------------------------------------------------------------------------
-- 2) Funções de contexto (conta ativa e papel do usuário)
-- ---------------------------------------------------------------------------
create function public.active_workspace_id()
returns uuid
language plpgsql security definer stable
set search_path = public
as $$
declare
  h text;
  w uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  begin
    h := (current_setting('request.headers', true)::json ->> 'x-workspace-id');
  exception when others then
    h := null;
  end;

  if h is not null and h ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    w := h::uuid;
    if exists (select 1 from public.team_members where workspace_id = w and profile_id = auth.uid()) then
      return w;
    end if;
  end if;

  return (
    select workspace_id from public.team_members
     where profile_id = auth.uid()
     order by created_at
     limit 1
  );
end;
$$;

create function public.crm_my_member_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select id from public.team_members
   where profile_id = auth.uid() and workspace_id = public.active_workspace_id();
$$;

create function public.is_ws_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
     where profile_id = auth.uid()
       and workspace_id = public.active_workspace_id()
       and crm_role = 'administrador'
  );
$$;

-- Administrador e gestor enxergam toda a carteira; vendedor só a própria.
create function public.crm_can_see_all()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
     where profile_id = auth.uid()
       and workspace_id = public.active_workspace_id()
       and crm_role in ('administrador', 'gestor')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Tabelas do CRM
-- ---------------------------------------------------------------------------
create table public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id),
  name text not null,
  position int not null,
  color text not null default '#FF007A',
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  role text check (
    role in ('lead', 'tentativa', 'contato', 'briefing', 'diagnostico_proposta', 'negociacao', 'standby')
  )
);
create index idx_crm_stages_pipeline_id on public.crm_stages (pipeline_id, position);

create table public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null,
  website text,
  segment text,
  city text,
  employee_count text,
  social_links jsonb not null default '{}',
  approx_revenue text,
  internal_notes text,
  instagram text,
  postal_code text,
  cnpj text,
  google_business_url text,
  other_social_url text,
  bio_link text,
  created_at timestamptz not null default now()
);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.crm_companies(id) on delete cascade,
  name text not null,
  role_title text,
  phone text,
  whatsapp text,
  email text,
  contact_preference text,
  created_at timestamptz not null default now()
);

-- Cliente fechado (ganho). Cadastro mínimo: o CRM cria/linka ao fechar.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  company_name text not null,
  label_color text not null default '#FF007A',
  monthly_value numeric(12,2),
  payment_due_day int check (payment_due_day is null or payment_due_day between 1 and 31),
  contract_start_date date,
  created_at timestamptz not null default now()
);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.crm_companies(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id),
  service_interest text,
  estimated_value numeric(10,2),
  close_probability int,
  expected_close_date date,
  responsible_id uuid references public.team_members(id) on delete set null,
  stage_id uuid not null references public.crm_stages(id),
  temperature text check (temperature in ('frio', 'morno', 'quente')),
  priority text,
  search_reason text,
  main_problem text,
  desired_objective text,
  available_budget text,
  decision_maker text,
  start_deadline text,
  acquisition_channel text,
  campaign text,
  ad text,
  form_name text,
  landing_page text,
  referred_by text,
  referral_related_client text,
  referral_type text,
  referral_date date,
  referral_result text,
  ad_platform text,
  ad_set text,
  keyword text,
  event_name text,
  first_touch_channel text,
  last_touch_channel text,
  entered_at timestamptz not null default now(),
  rescue_status text,
  in_nurturing boolean not null default false,
  nurturing_return_date date,
  status text not null default 'aberta' check (status in ('aberta', 'fechada', 'perdida')),
  loss_reason text,
  loss_details text,
  won_client_id uuid references public.clients(id) on delete set null,
  deal_type text check (deal_type in ('recorrencia', 'projeto')),
  payment_defined_at timestamptz,
  closed_at timestamptz,
  lost_at timestamptz,
  first_contact_at timestamptz,
  enrichment_checked_at timestamptz,
  stale_alert_sent_at date,
  created_at timestamptz not null default now()
);
create index idx_crm_opportunities_stage_id on public.crm_opportunities (stage_id);
create index idx_crm_opportunities_company_id on public.crm_opportunities (company_id);
create index idx_crm_opportunities_ws_status on public.crm_opportunities (workspace_id, status);
create index idx_crm_opportunities_closed_at on public.crm_opportunities (closed_at) where closed_at is not null;
create index idx_crm_opportunities_lost_at on public.crm_opportunities (lost_at) where lost_at is not null;

create table public.crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  from_stage_id uuid references public.crm_stages(id) on delete set null,
  to_stage_id uuid references public.crm_stages(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index idx_crm_stage_history_opportunity_id on public.crm_stage_history (opportunity_id);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  type text not null check (type in (
    'ligar', 'whatsapp', 'email', 'pesquisa', 'agendar_reuniao',
    'realizar_reuniao', 'preparar_diagnostico', 'preparar_proposta',
    'follow_up', 'solicitar_indicacao'
  )),
  responsible_id uuid references public.team_members(id) on delete set null,
  due_at timestamptz not null,
  priority text,
  description text,
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'cancelada')),
  activity_result text,
  source text not null default 'manual' check (source in ('manual', 'followup', 'cadence')),
  stage_id uuid references public.crm_stages(id) on delete set null,
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  overdue_alert_sent_at date,
  created_at timestamptz not null default now()
);
create index idx_crm_tasks_followup_pending
  on public.crm_tasks (opportunity_id, stage_id)
  where source = 'followup' and status = 'pendente';
create index idx_crm_tasks_completed_at on public.crm_tasks (completed_at) where completed_at is not null;

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  type text not null check (type in (
    'mensagem', 'ligacao', 'email', 'reuniao', 'mudanca_etapa',
    'tarefa', 'anotacao', 'arquivo', 'proposta', 'motivo_perda', 'automacao'
  )),
  content text,
  file_url text,
  actor_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index idx_crm_activities_opportunity on public.crm_activities (opportunity_id, occurred_at desc);

create table public.crm_cadence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  cadence_type text not null check (cadence_type in ('resgate_conversa', 'resgate_reuniao', 'follow_up_proposta')),
  step_number int not null,
  scheduled_for date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  presented_at date,
  value numeric(10,2),
  validity_date date,
  decision_makers text,
  objections text,
  agreed_response_date date,
  next_contact_date date,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table public.crm_followup_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  stage_id uuid not null unique references public.crm_stages(id) on delete cascade,
  task_type text not null default 'follow_up' check (task_type in (
    'ligar', 'whatsapp', 'email', 'pesquisa', 'agendar_reuniao',
    'realizar_reuniao', 'preparar_diagnostico', 'preparar_proposta',
    'follow_up', 'solicitar_indicacao'
  )),
  interval_days int not null default 3 check (interval_days between 0 and 365),
  repeat boolean not null default true,
  daily_goal int check (daily_goal is null or daily_goal >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.crm_daily_picks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  pick_date date not null,
  responsible_id uuid not null references public.team_members(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pick_date, responsible_id, opportunity_id)
);
create index idx_crm_daily_picks_day on public.crm_daily_picks (pick_date, responsible_id);

create table public.crm_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  metric text not null,
  owner_id uuid references public.team_members(id) on delete cascade,
  target numeric not null check (target >= 0),
  direction text not null default 'higher' check (direction in ('higher', 'lower')),
  updated_at timestamptz not null default now()
);
create unique index uq_crm_goals_metric_owner
  on public.crm_goals (workspace_id, metric, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.crm_off_days (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  off_date date not null,
  responsible_id uuid not null references public.team_members(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (off_date, responsible_id)
);
create index idx_crm_off_days_person on public.crm_off_days (responsible_id, off_date);

-- Parcelas a receber (venda de projeto, 1ª mensalidade, comissão).
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  sale_id uuid not null,
  kind text not null check (kind in ('projeto', 'comissao', 'primeira_mensalidade')),
  client_id uuid references public.clients(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  description text not null,
  method text,
  sale_total numeric(12,2) not null check (sale_total >= 0),
  installment_number int not null default 1,
  installments_total int not null default 1,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_receivables_sale on public.receivables (sale_id);
create index idx_receivables_due on public.receivables (due_date) where status = 'pending';
create index idx_receivables_paid on public.receivables (paid_at) where status = 'paid';

-- ---------------------------------------------------------------------------
-- 4) Gatilhos do CRM
-- ---------------------------------------------------------------------------
-- Toda mudança de etapa grava histórico.
create function public.crm_log_stage_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') or (old.stage_id is distinct from new.stage_id) then
    insert into public.crm_stage_history (workspace_id, opportunity_id, from_stage_id, to_stage_id, changed_by)
    values (
      new.workspace_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.stage_id end,
      new.stage_id,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger crm_opportunities_stage_history
  after insert or update on public.crm_opportunities
  for each row execute function public.crm_log_stage_change();

-- Datas de fechamento / perda / primeira abordagem.
create function public.crm_opportunity_lifecycle()
returns trigger
language plpgsql
as $$
declare
  old_role text;
  new_role text;
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
    select role into old_role from public.crm_stages where id = old.stage_id;
    select role into new_role from public.crm_stages where id = new.stage_id;
    if old_role = 'lead' and new_role is distinct from 'lead' then
      new.first_contact_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger crm_opportunities_lifecycle
  before update on public.crm_opportunities
  for each row execute function public.crm_opportunity_lifecycle();

create function public.crm_activity_first_contact()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.type in ('mensagem', 'ligacao', 'email', 'reuniao') then
    update public.crm_opportunities
       set first_contact_at = coalesce(first_contact_at, new.occurred_at)
     where id = new.opportunity_id and first_contact_at is null;
  end if;
  return new;
end;
$$;

create trigger crm_activities_first_contact
  after insert on public.crm_activities
  for each row execute function public.crm_activity_first_contact();

-- ---------------------------------------------------------------------------
-- 5) Padrões de uma conta nova (funil, regras de follow-up, metas)
-- ---------------------------------------------------------------------------
create function public.seed_workspace_defaults(p_ws uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
begin
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

-- ---------------------------------------------------------------------------
-- 6) Cadastro: perfil + conta própria + convites pendentes
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_name text;
  v_email text := lower(new.email);
  v_ws uuid;
  inv record;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1));

  insert into public.profiles (id, full_name, email)
  values (new.id, v_name, v_email);

  -- Conta própria (sempre a primeira, ou seja, a padrão).
  insert into public.workspaces (name, owner_id)
  values ('Conta de ' || v_name, new.id)
  returning id into v_ws;

  insert into public.team_members (workspace_id, profile_id, full_name, email, crm_role)
  values (v_ws, new.id, v_name, v_email, 'administrador');

  perform public.seed_workspace_defaults(v_ws);

  -- Convites feitos para este e-mail antes do cadastro.
  for inv in select * from public.workspace_invites where email = v_email loop
    insert into public.team_members (workspace_id, profile_id, full_name, email, crm_role)
    values (inv.workspace_id, new.id, v_name, v_email, inv.crm_role)
    on conflict (workspace_id, profile_id) do nothing;
  end loop;
  delete from public.workspace_invites where email = v_email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nome/foto do perfil acompanham os vínculos nas contas.
create function public.sync_profile_to_members()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.team_members
     set full_name = new.full_name, photo_url = new.photo_url
   where profile_id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_members
  after update of full_name, photo_url on public.profiles
  for each row execute function public.sync_profile_to_members();

-- ---------------------------------------------------------------------------
-- 7) Compartilhamento de conta (RPCs)
-- ---------------------------------------------------------------------------
create function public._require_ws_admin(p_ws uuid)
returns void
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.team_members
     where workspace_id = p_ws and profile_id = auth.uid() and crm_role = 'administrador'
  ) then
    raise exception 'Apenas administradores da conta podem fazer isso.';
  end if;
end;
$$;

create function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_ws uuid;
  p public.profiles;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Informe o nome da conta.'; end if;
  select * into p from public.profiles where id = auth.uid();

  insert into public.workspaces (name, owner_id) values (trim(p_name), auth.uid())
  returning id into v_ws;
  insert into public.team_members (workspace_id, profile_id, full_name, email, photo_url, crm_role)
  values (v_ws, auth.uid(), p.full_name, p.email, p.photo_url, 'administrador');
  perform public.seed_workspace_defaults(v_ws);
  return v_ws;
end;
$$;

create function public.rename_workspace(p_ws uuid, p_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform public._require_ws_admin(p_ws);
  if coalesce(trim(p_name), '') = '' then raise exception 'Informe o nome da conta.'; end if;
  update public.workspaces set name = trim(p_name) where id = p_ws;
end;
$$;

create function public.delete_workspace(p_ws uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.workspaces where id = p_ws and owner_id = auth.uid()) then
    raise exception 'Só o dono da conta pode excluí-la.';
  end if;
  if (select count(*) from public.team_members where profile_id = auth.uid()) <= 1 then
    raise exception 'Você precisa manter ao menos uma conta. Crie outra antes de excluir esta.';
  end if;
  delete from public.workspaces where id = p_ws;
end;
$$;

-- Compartilha a conta: quem já tem login entra direto; os demais ficam como
-- convite pendente e entram ao se cadastrar com esse e-mail.
create function public.invite_to_workspace(p_ws uuid, p_email text, p_role text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  prof public.profiles;
begin
  perform public._require_ws_admin(p_ws);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if p_role not in ('administrador', 'gestor', 'vendedor') then raise exception 'Papel inválido.'; end if;

  select * into prof from public.profiles where email = v_email;
  if found then
    if exists (select 1 from public.team_members where workspace_id = p_ws and profile_id = prof.id) then
      raise exception 'Essa pessoa já participa da conta.';
    end if;
    insert into public.team_members (workspace_id, profile_id, full_name, email, photo_url, crm_role)
    values (p_ws, prof.id, prof.full_name, prof.email, prof.photo_url, p_role);
    return 'added';
  end if;

  insert into public.workspace_invites (workspace_id, email, crm_role, invited_by)
  values (p_ws, v_email, p_role, auth.uid())
  on conflict (workspace_id, email) do update set crm_role = excluded.crm_role;
  return 'invited';
end;
$$;

create function public.cancel_invite(p_invite_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.workspace_invites where id = p_invite_id;
  if v_ws is null then return; end if;
  perform public._require_ws_admin(v_ws);
  delete from public.workspace_invites where id = p_invite_id;
end;
$$;

create function public.set_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m public.team_members;
begin
  select * into m from public.team_members where id = p_member_id;
  if not found then raise exception 'Membro não encontrado.'; end if;
  perform public._require_ws_admin(m.workspace_id);
  if p_role not in ('administrador', 'gestor', 'vendedor') then raise exception 'Papel inválido.'; end if;
  if exists (select 1 from public.workspaces where id = m.workspace_id and owner_id = m.profile_id) then
    raise exception 'O dono da conta sempre é administrador.';
  end if;
  update public.team_members set crm_role = p_role where id = p_member_id;
end;
$$;

-- Admin remove alguém; qualquer um pode sair (exceto o dono).
create function public.remove_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m public.team_members;
begin
  select * into m from public.team_members where id = p_member_id;
  if not found then return; end if;
  if exists (select 1 from public.workspaces where id = m.workspace_id and owner_id = m.profile_id) then
    raise exception 'O dono não pode ser removido da própria conta.';
  end if;
  if m.profile_id <> auth.uid() then
    perform public._require_ws_admin(m.workspace_id);
  end if;
  -- Itens que eram dele ficam sem responsável (ON DELETE SET NULL).
  delete from public.team_members where id = p_member_id;
end;
$$;

-- Membros da conta ativa, para seletores de responsável.
create function public.team_member_picker_options()
returns table (id uuid, full_name text, photo_url text)
language sql security definer stable
set search_path = public
as $$
  select tm.id, tm.full_name, tm.photo_url
    from public.team_members tm
   where tm.workspace_id = public.active_workspace_id()
   order by tm.full_name;
$$;

create function public.update_my_profile(p_full_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Informe seu nome.'; end if;
  update public.profiles set full_name = trim(p_full_name) where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.team_members enable row level security;
alter table public.workspace_invites enable row level security;

create policy "profiles: leio o meu e dos colegas" on public.profiles
  for select using (
    id = auth.uid()
    or id in (
      select tm.profile_id from public.team_members tm
       where tm.workspace_id in (select workspace_id from public.team_members where profile_id = auth.uid())
    )
  );

create policy "workspaces: membros leem" on public.workspaces
  for select using (id in (select workspace_id from public.team_members where profile_id = auth.uid()));

create policy "team_members: da conta ativa ou os meus vínculos" on public.team_members
  for select using (workspace_id = public.active_workspace_id() or profile_id = auth.uid());

create policy "workspace_invites: admin da conta lê" on public.workspace_invites
  for select using (workspace_id = public.active_workspace_id() and public.is_ws_admin());

-- Tabelas "da conta": qualquer membro lê e escreve.
do $$
declare
  t text;
begin
  foreach t in array array[
    'crm_companies', 'crm_contacts', 'crm_cadence_steps', 'crm_proposals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (workspace_id = public.active_workspace_id()) with check (workspace_id = public.active_workspace_id())',
      t || ': membros da conta', t);
  end loop;

  -- Configuração: todos leem, só administrador altera.
  foreach t in array array[
    'crm_pipelines', 'crm_stages', 'crm_followup_rules', 'crm_goals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (workspace_id = public.active_workspace_id())',
      t || ': leitura', t);
    execute format(
      'create policy %I on public.%I for all using (workspace_id = public.active_workspace_id() and public.is_ws_admin()) with check (workspace_id = public.active_workspace_id() and public.is_ws_admin())',
      t || ': administrador gerencia', t);
  end loop;

  -- Agenda pessoal: todos veem/editam se for gestor+ ou se for o responsável.
  foreach t in array array['crm_daily_picks', 'crm_off_days'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (workspace_id = public.active_workspace_id() and (public.crm_can_see_all() or responsible_id = public.crm_my_member_id())) with check (workspace_id = public.active_workspace_id() and (public.crm_can_see_all() or responsible_id = public.crm_my_member_id()))',
      t || ': todas ou próprias', t);
  end loop;
end
$$;

alter table public.crm_opportunities enable row level security;
create policy "crm_opportunities: todas ou próprias" on public.crm_opportunities
  for all using (
    workspace_id = public.active_workspace_id()
    and (public.crm_can_see_all() or responsible_id = public.crm_my_member_id())
  )
  with check (
    workspace_id = public.active_workspace_id()
    and (public.crm_can_see_all() or responsible_id = public.crm_my_member_id())
  );

alter table public.crm_tasks enable row level security;
create policy "crm_tasks: todas ou próprias" on public.crm_tasks
  for all using (
    workspace_id = public.active_workspace_id()
    and (public.crm_can_see_all() or responsible_id = public.crm_my_member_id())
  )
  with check (
    workspace_id = public.active_workspace_id()
    and (public.crm_can_see_all() or responsible_id = public.crm_my_member_id())
  );

alter table public.crm_activities enable row level security;
create policy "crm_activities: ver as da carteira visível" on public.crm_activities
  for select using (
    workspace_id = public.active_workspace_id()
    and (
      public.crm_can_see_all()
      or opportunity_id in (select id from public.crm_opportunities where responsible_id = public.crm_my_member_id())
    )
  );
create policy "crm_activities: inserir na conta" on public.crm_activities
  for insert with check (workspace_id = public.active_workspace_id());

alter table public.crm_stage_history enable row level security;
create policy "crm_stage_history: leitura da carteira visível" on public.crm_stage_history
  for select using (
    workspace_id = public.active_workspace_id()
    and (
      public.crm_can_see_all()
      or opportunity_id in (select id from public.crm_opportunities where responsible_id = public.crm_my_member_id())
    )
  );

alter table public.clients enable row level security;
create policy "clients: membros leem e criam" on public.clients
  for select using (workspace_id = public.active_workspace_id());
create policy "clients: membros criam" on public.clients
  for insert with check (workspace_id = public.active_workspace_id());
create policy "clients: administrador altera" on public.clients
  for update using (workspace_id = public.active_workspace_id() and public.is_ws_admin())
  with check (workspace_id = public.active_workspace_id() and public.is_ws_admin());
create policy "clients: administrador exclui" on public.clients
  for delete using (workspace_id = public.active_workspace_id() and public.is_ws_admin());

alter table public.receivables enable row level security;
create policy "receivables: administrador gerencia" on public.receivables
  for all using (workspace_id = public.active_workspace_id() and public.is_ws_admin())
  with check (workspace_id = public.active_workspace_id() and public.is_ws_admin());

-- ---------------------------------------------------------------------------
-- 9) Permissões de API e anexos (Storage)
-- ---------------------------------------------------------------------------
revoke all on function public._require_ws_admin(uuid) from public, anon, authenticated;
revoke all on function public.seed_workspace_defaults(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_profile_to_members() from public, anon, authenticated;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.rename_workspace(uuid, text) to authenticated;
grant execute on function public.delete_workspace(uuid) to authenticated;
grant execute on function public.invite_to_workspace(uuid, text, text) to authenticated;
grant execute on function public.cancel_invite(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.team_member_picker_options() to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;

-- Bucket privado de anexos da linha do tempo. O app grava em
-- "<workspace_id>/<oportunidade>/<arquivo>"; só membros dessa conta acessam.
insert into storage.buckets (id, name, public)
values ('crm-attachments', 'crm-attachments', false)
on conflict (id) do nothing;

create policy "crm-attachments: membros da conta" on storage.objects
  for all using (
    bucket_id = 'crm-attachments'
    and (storage.foldername(name))[1] = public.active_workspace_id()::text
  )
  with check (
    bucket_id = 'crm-attachments'
    and (storage.foldername(name))[1] = public.active_workspace_id()::text
  );
