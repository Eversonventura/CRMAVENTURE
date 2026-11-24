-- Sprint 39 — Leads automáticos do WhatsApp (Cloud API oficial).
-- Quando alguém manda a primeira mensagem para o WhatsApp comercial do cliente, o webhook chama
-- crm_whatsapp_ingest: acha ou cria o contato e cria o card em "Novo lead", tudo numa transação,
-- sem duplicar por reenvio ou mensagens simultâneas. Só o servidor (service_role) executa a função.
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez.

-- Identificador do WhatsApp do contato (número, ou o identificador opaco quando o telefone vem oculto).
alter table public.crm_contacts add column if not exists wa_id text;
create unique index if not exists uq_crm_contacts_wa_id on public.crm_contacts (workspace_id, wa_id) where wa_id is not null;

-- Chave de comparação de telefones brasileiros: DDD + últimos 8 dígitos. Casa "(85) 99690-3413",
-- "+55 85 996903413" e "558596903413" (com ou sem o 9), que são o mesmo número.
create or replace function public.crm_phone_key(p text)
returns text
language sql immutable
as $$
  select case
    when length(v) = 0 then null
    when v like '55%' and length(v) in (12, 13) then 'br' || left(substr(v, 3), 2) || right(v, 8)
    when length(v) in (10, 11) then 'br' || left(v, 2) || right(v, 8)
    else v
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as v) d;
$$;
create index if not exists idx_crm_contacts_phone_key on public.crm_contacts (workspace_id, public.crm_phone_key(phone));
create index if not exists idx_crm_contacts_whatsapp_key on public.crm_contacts (workspace_id, public.crm_phone_key(whatsapp));

-- Número comercial (phone_number_id da Meta) → conta. Só números cadastrados aqui são aceitos.
-- Cadastro pela operação (SQL Editor / chave de serviço); o administrador da conta só enxerga.
create table if not exists public.crm_whatsapp_numbers (
  phone_number_id text primary key,
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null, -- vazio = fluxo padrão da conta
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.crm_whatsapp_numbers enable row level security;
drop policy if exists "crm_whatsapp_numbers: administrador lê" on public.crm_whatsapp_numbers;
create policy "crm_whatsapp_numbers: administrador lê" on public.crm_whatsapp_numbers
  for select using (workspace_id = public.active_workspace_id() and public.is_ws_admin());

-- Mensagens já processadas (id da mensagem da Meta): só o necessário para não duplicar em reenvios.
create table if not exists public.crm_whatsapp_events (
  wamid text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.crm_whatsapp_events enable row level security; -- sem políticas: só a função/servidor

create or replace function public.crm_whatsapp_ingest(
  p_phone_number_id text,
  p_wamid text,
  p_wa_id text,        -- identificador do contato (wa_id / user id), se vier
  p_phone text,        -- telefone, se vier (pode ser nulo quando oculto)
  p_profile_name text, -- nome de perfil do WhatsApp
  p_has_ad boolean,    -- a mensagem veio de um anúncio (referral)
  p_ad_id text         -- id do anúncio, se vier
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  ws uuid;
  pipe uuid;
  stage uuid;
  ident text := nullif(trim(coalesce(p_wa_id, '')), '');
  digits text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  pname text := nullif(trim(coalesce(p_profile_name, '')), '');
  key text;
  cid uuid;
  coid uuid;
  oid uuid;
  cname text;
  formatted text;
  inserted int;
  ch text;
  contact_created boolean := false;
begin
  select n.workspace_id, n.pipeline_id into ws, pipe
    from public.crm_whatsapp_numbers n
   where n.phone_number_id = p_phone_number_id and n.active;
  if ws is null then
    return jsonb_build_object('status', 'unmapped');
  end if;
  if ident is null and digits is null then
    return jsonb_build_object('status', 'invalid');
  end if;
  -- O identificador numérico também serve de telefone quando o campo de telefone não veio.
  if digits is null and ident ~ '^\d{8,15}$' then digits := ident; end if;
  if ident is null then ident := digits; end if;

  -- Mensagens do mesmo contato entram uma de cada vez (duas ao mesmo tempo não criam dois cards).
  perform pg_advisory_xact_lock(hashtextextended(ws::text || ':' || ident, 0));

  insert into public.crm_whatsapp_events (wamid, workspace_id) values (p_wamid, ws) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('status', 'duplicate', 'workspace_id', ws);
  end if;

  pipe := coalesce(pipe, (select id from public.crm_pipelines where workspace_id = ws order by position, created_at limit 1));
  select s.id into stage
    from public.crm_stages s
   where s.workspace_id = ws and s.pipeline_id = pipe and s.role = 'lead' and s.kind = 'open'
   order by (lower(trim(s.name)) = 'novo lead') desc, s.position
   limit 1;
  if stage is null then
    -- Sem etapa de entrada não há onde criar o card; desfaz o registro da mensagem para não perder o lead se a conta for ajustada.
    delete from public.crm_whatsapp_events where wamid = p_wamid;
    return jsonb_build_object('status', 'no_stage', 'workspace_id', ws);
  end if;

  key := public.crm_phone_key(digits);
  formatted := case when digits is not null then '+' || digits end;

  -- Contato da conta: pelo identificador do WhatsApp ou pelo telefone (qualquer formato digitado pelo vendedor).
  select c.id, c.company_id into cid, coid
    from public.crm_contacts c
   where c.workspace_id = ws
     and (c.wa_id = ident
          or (key is not null and (public.crm_phone_key(c.phone) = key or public.crm_phone_key(c.whatsapp) = key)))
   order by (c.wa_id = ident) desc nulls last, c.created_at
   limit 1;

  if cid is not null then
    -- Só preenche o que está vazio: o que o vendedor já digitou fica como está.
    update public.crm_contacts c
       set wa_id = coalesce(c.wa_id, ident),
           whatsapp = case when coalesce(trim(c.whatsapp), '') = '' and coalesce(trim(c.phone), '') = '' then formatted else c.whatsapp end,
           name = case when pname is not null and c.name like 'WhatsApp %' then pname else c.name end
     where c.id = cid;
    update public.crm_companies co
       set name = pname
     where co.id = coid and pname is not null and co.name like 'WhatsApp %'
       and not exists (select 1 from public.crm_contacts x where x.company_id = coid and x.name not like 'WhatsApp %' and x.id <> cid);
  else
    cname := coalesce(pname, 'WhatsApp ' || coalesce(formatted, ident));
    insert into public.crm_companies (workspace_id, name) values (ws, cname) returning id into coid;
    insert into public.crm_contacts (workspace_id, company_id, name, whatsapp, wa_id, contact_preference)
    values (ws, coid, cname, formatted, ident, 'WhatsApp')
    returning id into cid;
    contact_created := true;
  end if;

  -- Já tem card aberto desse contato neste fluxo? Mantém o card e a etapa onde estão.
  select o.id into oid
    from public.crm_opportunities o
    join public.crm_stages s on s.id = o.stage_id
   where o.workspace_id = ws and o.contact_id = cid and o.status = 'aberta' and s.pipeline_id = pipe
   order by o.created_at
   limit 1;
  if oid is not null then
    update public.crm_whatsapp_events set contact_id = cid, opportunity_id = oid where wamid = p_wamid;
    return jsonb_build_object('status', 'existing_open', 'workspace_id', ws, 'contact_id', cid, 'opportunity_id', oid, 'contact_created', contact_created);
  end if;

  -- Origem: WhatsApp; vinda de anúncio, Meta Ads (com o id do anúncio, se vier).
  ch := case when p_has_ad then 'Meta Ads' else 'WhatsApp' end;
  if exists (select 1 from public.crm_acquisition_channels where workspace_id = ws) then
    insert into public.crm_acquisition_channels (workspace_id, name, is_ad, position)
    select ws, ch, p_has_ad, coalesce(max(position), 0) + 1 from public.crm_acquisition_channels where workspace_id = ws
    on conflict (workspace_id, name) do nothing;
  end if;

  insert into public.crm_opportunities (
    workspace_id, company_id, contact_id, stage_id,
    acquisition_channel, first_touch_channel, last_touch_channel,
    ad_platform, ad, search_reason
  ) values (
    ws, coid, cid, stage,
    ch, 'WhatsApp', 'WhatsApp',
    case when p_has_ad then 'Meta' end, case when p_has_ad then nullif(trim(coalesce(p_ad_id, '')), '') end,
    'Lead recebido pelo WhatsApp.'
  ) returning id into oid;

  insert into public.crm_activities (workspace_id, opportunity_id, type, content)
  values (ws, oid, 'automacao', case when p_has_ad then 'Lead recebido pelo WhatsApp, vindo de anúncio (Meta Ads).' else 'Lead recebido pelo WhatsApp.' end);

  update public.crm_whatsapp_events set contact_id = cid, opportunity_id = oid where wamid = p_wamid;
  return jsonb_build_object('status', 'created', 'workspace_id', ws, 'contact_id', cid, 'opportunity_id', oid, 'stage_id', stage, 'contact_created', contact_created);
end;
$$;

revoke all on function public.crm_whatsapp_ingest(text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.crm_whatsapp_ingest(text, text, text, text, text, boolean, text) to service_role;
