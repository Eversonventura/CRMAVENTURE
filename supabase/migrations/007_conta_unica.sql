-- Sprint 29 — Uma pessoa trabalha numa conta só (sem trocar de conta).
-- A conta "Conta de <nome>", criada automaticamente no cadastro, fica por último: vale a conta da empresa
-- para a qual a pessoa foi convidada ou que o Hub criou. O cabeçalho x-workspace-id deixa de ser usado.
-- Mesma assinatura de antes (o Hub e as políticas continuam funcionando). Rode no SQL Editor do Supabase.

create or replace function public.active_workspace_id()
returns uuid
language plpgsql security definer stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    return null;
  end if;

  return (
    select tm.workspace_id
      from public.team_members tm
      join public.workspaces w on w.id = tm.workspace_id
     where tm.profile_id = auth.uid()
     order by (w.owner_id = tm.profile_id and w.name like 'Conta de %'), tm.created_at
     limit 1
  );
end;
$$;
