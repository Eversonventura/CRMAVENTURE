-- Sprint 32 — Meta olímpica visível para todos (administrador, gestor e vendedor), mês a mês.
-- O vendedor só enxerga os próprios leads (RLS), mas a meta olímpica é da EQUIPE. Esta função devolve, sem nomes
-- de clientes, os negócios fechados no período para quem for membro da conta ativa, com o valor do plano de
-- pagamento do projeto (que só o administrador lê direto). Rode no SQL Editor do Supabase.

create or replace function public.crm_month_deals(p_start timestamptz, p_end timestamptz)
returns table (
  opportunity_id uuid,
  estimated_value numeric,
  deal_type text,
  closed_at timestamptz,
  won_client_id uuid,
  plan_total numeric
)
language sql security definer stable
set search_path = public
as $$
  select o.id, o.estimated_value, o.deal_type, o.closed_at, o.won_client_id,
         (select r.sale_total from public.receivables r
           where r.opportunity_id = o.id and r.kind = 'projeto'
           limit 1)
    from public.crm_opportunities o
   where o.workspace_id = public.active_workspace_id()
     and exists (select 1 from public.team_members tm
                  where tm.workspace_id = o.workspace_id and tm.profile_id = auth.uid())
     and o.status = 'fechada'
     and o.closed_at >= p_start
     and o.closed_at < p_end;
$$;

revoke all on function public.crm_month_deals(timestamptz, timestamptz) from public, anon;
grant execute on function public.crm_month_deals(timestamptz, timestamptz) to authenticated;
