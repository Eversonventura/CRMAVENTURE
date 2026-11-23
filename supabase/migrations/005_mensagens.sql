-- Sprint 17 — Mensagens sugeridas (tentativa de contato, follow-up, indicação, outro).
-- Rode no SQL Editor do Supabase (banco que já tem o schema.sql aplicado).

-- Modelos de mensagem sugeridos no card do lead (tentativa de contato, follow-up, indicação…).
-- Variáveis no texto: {nome} (contato), {empresa} e {vendedor} (quem está enviando).
create table public.crm_message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.active_workspace_id() references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('tentativa', 'follow_up', 'indicacao', 'outro')),
  title text not null,
  body text not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_crm_message_templates_ws on public.crm_message_templates (workspace_id, kind, position);

alter table public.crm_message_templates enable row level security;
create policy "crm_message_templates: leitura" on public.crm_message_templates
  for select using (workspace_id = public.active_workspace_id());
create policy "crm_message_templates: administrador gerencia" on public.crm_message_templates
  for all using (workspace_id = public.active_workspace_id() and public.is_ws_admin())
  with check (workspace_id = public.active_workspace_id() and public.is_ws_admin());

-- Função interna que cria os modelos padrão de uma conta.
create function public.seed_message_templates(p_ws uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.crm_message_templates (workspace_id, kind, title, body, position) values
    (p_ws, 'tentativa', 'Primeira tentativa', 'Olá, {nome}! Aqui é {vendedor}. Tudo bem? Vi o seu contato e queria entender melhor o que você está buscando. Posso te ligar, ou prefere conversar por aqui?', 0),
    (p_ws, 'tentativa', 'Segunda tentativa', 'Oi, {nome}! Tentei falar com você mais cedo. Qual o melhor horário para conversarmos hoje ou amanhã?', 1),
    (p_ws, 'follow_up', 'Retomar a conversa', 'Oi, {nome}, tudo bem? Passando para saber se você teve a chance de pensar no que conversamos. Posso ajudar com alguma dúvida?', 0),
    (p_ws, 'follow_up', 'Depois da proposta', 'Olá, {nome}! Conseguiu avaliar a proposta que enviei? Se quiser, ajusto algum ponto para ficar mais adequado para você.', 1),
    (p_ws, 'indicacao', 'Pedir indicação', 'Oi, {nome}! Que bom que deu tudo certo por aqui. Você conhece alguém que também poderia se beneficiar do nosso trabalho? Se puder indicar, agradeço muito!', 0),
    (p_ws, 'outro', 'Agradecimento', 'Obrigado pelo seu tempo, {nome}! Qualquer dúvida, é só chamar.', 0);
end;
$$;
revoke all on function public.seed_message_templates(uuid) from public, anon, authenticated;

-- Contas que já existem ganham os modelos padrão (só as que ainda não têm nenhum).
select public.seed_message_templates(w.id)
  from public.workspaces w
 where not exists (select 1 from public.crm_message_templates t where t.workspace_id = w.id);

-- Conta nova passa a ganhar os modelos (mesma assinatura de antes: o Hub continua chamando seed_workspace_defaults).
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
