-- Sprint 28 — Permissões do gestor.
-- Administrador configura tudo. O gestor também altera a CADÊNCIA (metas diárias/semanais do Diário)
-- e os FOLLOW-UPS por etapa; perfil do negócio, meta olímpica, metas do mês e etapas continuam só do administrador.
-- Rode no SQL Editor do Supabase (banco que já tem o schema aplicado). Pode rodar mais de uma vez.

drop policy if exists "crm_followup_rules: gestor gerencia" on public.crm_followup_rules;
create policy "crm_followup_rules: gestor gerencia" on public.crm_followup_rules
  for all
  using (workspace_id = public.active_workspace_id() and public.crm_can_see_all())
  with check (workspace_id = public.active_workspace_id() and public.crm_can_see_all());

drop policy if exists "crm_goals: gestor gerencia cadência" on public.crm_goals;
create policy "crm_goals: gestor gerencia cadência" on public.crm_goals
  for all
  using (
    workspace_id = public.active_workspace_id() and public.crm_can_see_all() and owner_id is null
    and metric in ('daily_approaches', 'weekly_approaches', 'weekly_new_leads', 'weekly_ad_leads', 'daily_ad_replies')
  )
  with check (
    workspace_id = public.active_workspace_id() and public.crm_can_see_all() and owner_id is null
    and metric in ('daily_approaches', 'weekly_approaches', 'weekly_new_leads', 'weekly_ad_leads', 'daily_ad_replies')
  );
