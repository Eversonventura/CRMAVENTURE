-- Sprint 12 — Só o Aventure Hub cria contas.
-- Usuário do CRM não cria conta nova (só convida pessoas para a conta que já tem).
-- O Hub cria as contas com a chave de serviço (insert em workspaces + seed_workspace_defaults),
-- então a função create_workspace, que qualquer usuário logado podia chamar, deixa de existir.
-- Rode no SQL Editor do Supabase (banco que já tem o schema.sql aplicado).

drop function if exists public.create_workspace(text);

-- Mesma regra de antes (não dá para excluir a única conta), sem sugerir criar outra.
create or replace function public.delete_workspace(p_ws uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.workspaces where id = p_ws and owner_id = auth.uid()) then
    raise exception 'Só o dono da conta pode excluí-la.';
  end if;
  if (select count(*) from public.team_members where profile_id = auth.uid()) <= 1 then
    raise exception 'Você precisa manter ao menos uma conta.';
  end if;
  delete from public.workspaces where id = p_ws;
end;
$$;
