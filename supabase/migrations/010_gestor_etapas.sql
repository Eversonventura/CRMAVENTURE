-- Sprint 37 — O gestor também cria e edita as etapas do fluxo.
-- Administrador continua com tudo; pipelines (fluxos inteiros) seguem só do administrador.
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez.

drop policy if exists "crm_stages: gestor gerencia" on public.crm_stages;
create policy "crm_stages: gestor gerencia" on public.crm_stages
  for all
  using (workspace_id = public.active_workspace_id() and public.crm_can_see_all())
  with check (workspace_id = public.active_workspace_id() and public.crm_can_see_all());
