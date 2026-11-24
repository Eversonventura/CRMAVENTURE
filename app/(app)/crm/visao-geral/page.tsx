import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { getCrmAccessContext } from "../lib";
import { brtToday } from "../diario/dates";
import { classifyGoal, GOAL_METRICS, GOAL_TONE_CLASSES } from "../goals";
import type { SalesGoalMap } from "../sales-goals";
import { OlympicCard } from "./OlympicCard";
import { activeOlympicTargets, olympicMode, readOlympicSettings } from "../olympic";
import { isContract, monthlySales, type ReceivableSale } from "../olympic-sales";
import { BarBlock, PieBlock, type ChartDatum } from "./CrmCharts";

// Visão geral + Relatórios numa página só, com período e metas coloridas.
// Tudo é consultado por período / agregado (nada de varrer tabela inteira).

const PERIODS = {
  mes: { label: "Este mês", factor: 1 },
  anterior: { label: "Mês passado", factor: 1 },
  "30": { label: "30 dias", factor: 1 },
  "90": { label: "90 dias", factor: 3 },
  ano: { label: "12 meses", factor: 12 },
} as const;
type PeriodKey = keyof typeof PERIODS;

const BRT = 3;
function periodRange(key: PeriodKey) {
  const { date } = brtToday();
  const [y, m] = date.split("-").map(Number);
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1, BRT));
  const now = new Date();
  if (key === "mes") return { start: monthStart(y, m - 1), end: monthStart(y, m) };
  if (key === "anterior") return { start: monthStart(y, m - 2), end: monthStart(y, m - 1) };
  const days = key === "30" ? 30 : key === "90" ? 90 : 365;
  return { start: new Date(now.getTime() - days * 86400000), end: new Date(now.getTime() + 60000) };
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const one = <T,>(rel: T | T[] | null | undefined): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null));

function format(unit: "count" | "money" | "percent" | "days", v: number) {
  if (unit === "money") return money(v);
  if (unit === "percent") return `${v.toFixed(0)}%`;
  if (unit === "days") return `${v.toFixed(0)}d`;
  return String(Math.round(v));
}

function Bar({ value, goal, direction = "higher" }: { value: number; goal: number | null; direction?: "higher" | "lower" }) {
  if (goal === null) return <div className="h-2 w-full rounded-full bg-surface2" />;
  const tone = GOAL_TONE_CLASSES[classifyGoal(value, goal, direction)];
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
      <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function pctLabel(value: number, goal: number | null) {
  return goal !== null && goal > 0 ? `${Math.round((value / goal) * 100)}%` : "sem meta";
}

// Destaque da tela: vendas fechadas e receita x meta, da equipe e por vendedor.
function SalesPanel({
  periodLabel,
  team,
  sellers,
  showRevenue,
}: {
  showRevenue: boolean;
  periodLabel: string;
  team: { count: number; goalCount: number; revenue: number; goalRevenue: number } | null;
  sellers: { id: string; name: string; count: number; revenue: number; goalCount: number | null; goalRevenue: number | null }[];
}) {
  return (
    <section className="mb-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-base font-medium text-ink">Vendas e fechamentos</h2>
      <p className="mt-0.5 text-xs text-muted">{periodLabel} · {showRevenue ? "negócios que chegaram a Fechado e a receita deles, contra a meta." : "contratos fechados contra a meta."}</p>

      {team && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: showRevenue ? "Fechamentos da equipe" : "Contratos fechados da equipe", value: team.count, goal: team.goalCount, text: `${team.count} de ${Math.round(team.goalCount)}` },
            ...(showRevenue
              ? [{ label: "Receita fechada da equipe", value: team.revenue, goal: team.goalRevenue, text: `${money(team.revenue)} de ${money(team.goalRevenue)}` }]
              : []),
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted">{t.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GOAL_TONE_CLASSES[classifyGoal(t.value, t.goal)].chip}`}>{pctLabel(t.value, t.goal)}</span>
              </div>
              <p className="mt-1 font-display text-xl text-ink">{t.text}</p>
              <div className="mt-2">
                <Bar value={t.value} goal={t.goal} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-4 font-normal">Vendedor</th>
              <th className="py-2 pr-4 font-normal">{showRevenue ? "Fechamentos" : "Contratos fechados"}</th>
              {showRevenue && <th className="py-2 font-normal">Receita fechada</th>}
            </tr>
          </thead>
          <tbody>
            {sellers.length === 0 ? (
              <tr>
                <td colSpan={showRevenue ? 3 : 2} className="py-3 text-muted">Nenhuma pessoa na conta.</td>
              </tr>
            ) : (
              sellers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-ink">{s.name}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-ink">
                        {s.count}
                        {s.goalCount !== null ? ` / ${Math.round(s.goalCount)}` : ""}
                      </span>
                      <span className="text-muted">{pctLabel(s.count, s.goalCount)}</span>
                    </div>
                    <div className="mt-1 max-w-[220px]">
                      <Bar value={s.count} goal={s.goalCount} />
                    </div>
                  </td>
                  {showRevenue && (
                  <td className="py-2.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-ink">
                        {money(s.revenue)}
                        {s.goalRevenue !== null ? ` / ${money(s.goalRevenue)}` : ""}
                      </span>
                      <span className="text-muted">{pctLabel(s.revenue, s.goalRevenue)}</span>
                    </div>
                    <div className="mt-1 max-w-[260px]">
                      <Bar value={s.revenue} goal={s.goalRevenue} />
                    </div>
                  </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">Metas pessoais definidas em Configurações → Metas do mês.</p>
    </section>
  );
}

function Block({ title, hint, children, wide }: { title: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="font-display text-base font-medium text-ink">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function countMap<T>(items: T[], key: (i: T) => string) {
  const map = new Map<string, number>();
  for (const i of items) map.set(key(i), (map.get(key(i)) ?? 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export default async function CrmVisaoGeralPage({ searchParams }: { searchParams: Promise<{ periodo?: string; mes?: string }> }) {
  const sp = await searchParams;
  const periodo: PeriodKey = sp.periodo && sp.periodo in PERIODS ? (sp.periodo as PeriodKey) : "mes";
  const factor = PERIODS[periodo].factor;
  const { start, end } = periodRange(periodo);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const today = brtToday();

  const currentMonthKey = today.date.slice(0, 7);
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonthKey;
  const supabase = await createClient();
  const [crm, access] = await Promise.all([getCrmAccessContext(), getAccessContext()]);
  if (!crm.teamMemberId && !crm.canSeeAll) {
    return <p className="text-sm text-muted">Sem perfil de equipe vinculado.</p>;
  }

  const [
    goalsRes, stagesRes, pipelinesRes, membersRes,
    leadsPeriod, leadsToday, openRes, closedRes, lostRes,
    meetingsDone, meetingsScheduled, overdueRes, historyRes, todayTasksRes,
    recRes, closedOppsRes,
  ] = await Promise.all([
    supabase.from("crm_goals").select("metric, target, owner_id"),
    supabase.from("crm_stages").select("id, name, position, pipeline_id, role, kind").order("position"),
    supabase.from("crm_pipelines").select("id, name").order("position"),
    supabase.rpc("team_member_picker_options"),
    supabase.from("crm_opportunities").select("id", { count: "exact", head: true }).gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("crm_opportunities").select("id", { count: "exact", head: true }).gte("created_at", today.startIso).lt("created_at", today.endIso),
    supabase.from("crm_opportunities").select("stage_id, estimated_value").eq("status", "aberta").limit(2000),
    supabase
      .from("crm_opportunities")
      .select("estimated_value, acquisition_channel, event_name, responsible_id, created_at, closed_at")
      .eq("status", "fechada").gte("closed_at", startIso).lt("closed_at", endIso).limit(1000),
    supabase
      .from("crm_opportunities")
      .select("loss_reason")
      .eq("status", "perdida").gte("lost_at", startIso).lt("lost_at", endIso).limit(1000),
    supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("type", "realizar_reuniao").eq("status", "concluida").gte("completed_at", startIso).lt("completed_at", endIso),
    supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("type", "realizar_reuniao").eq("status", "pendente"),
    supabase.from("crm_tasks").select("responsible_id").eq("status", "pendente").lt("due_at", new Date().toISOString()).limit(2000),
    supabase.from("crm_stage_history").select("opportunity_id, to_stage_id, changed_at").gte("changed_at", startIso).lt("changed_at", endIso).order("changed_at").limit(5000),
    supabase
      .from("crm_tasks")
      .select("id, due_at, crm_opportunities(crm_companies(name))")
      .eq("status", "pendente").gte("due_at", today.startIso).lt("due_at", today.endIso).order("due_at").limit(50),
    supabase
      .from("receivables")
      .select("kind, client_id, sale_id, opportunity_id, description, amount, status, paid_at, due_date, installment_number, sale_total, created_at, clients(company_name)")
      .limit(2000),
    // Negócios fechados no mês da meta olímpica (ela conta VENDAS, não pagamentos).
    supabase
      .from("crm_opportunities")
      .select("id, estimated_value, closed_at, won_client_id, deal_type, crm_companies(name)")
      .eq("status", "fechada")
      .gte("closed_at", new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 3)).toISOString())
      .lt("closed_at", new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, 3)).toISOString())
      .limit(500),
  ]);

  const targets: Record<string, number> = {};
  // Metas da equipe (owner nulo) e metas de vendas por vendedor.
  const memberGoals: SalesGoalMap = {};
  for (const g of (goalsRes.data as { metric: string; target: number; owner_id: string | null }[] | null) ?? []) {
    if (g.owner_id === null) targets[g.metric] = Number(g.target);
    else if (g.metric === "fechamentos" || g.metric === "receita_fechada") {
      memberGoals[g.owner_id] = { ...memberGoals[g.owner_id], [g.metric]: Number(g.target) };
    }
  }

  // --- Meta olímpica: VENDAS fechadas no mês (valor ou nº de contratos) ---
  const { data: recRows } = recRes;
  const { data: closedOppRows } = closedOppsRes;
  type RecRow = { opportunity_id: string | null; description: string; clients: { company_name: string } | { company_name: string }[] | null; kind: string; client_id: string | null; sale_id: string; due_date: string; amount: number; status: string; paid_at: string | null; installment_number: number; sale_total: number; created_at: string };
  const receivables = (recRows as unknown as RecRow[] | null) ?? [];
  const oneRel = <T,>(r: T | T[] | null | undefined): T | null => (Array.isArray(r) ? (r[0] ?? null) : (r ?? null));

  const saleGroups = new Map<string, ReceivableSale>();
  for (const r of receivables) {
    const cur = saleGroups.get(r.sale_id);
    saleGroups.set(r.sale_id, {
      saleId: r.sale_id,
      kind: r.kind,
      opportunityId: r.opportunity_id,
      clientName: oneRel(r.clients)?.company_name ?? null,
      description: r.description,
      saleTotal: Number(r.sale_total),
      firstDue: cur && cur.firstDue < r.due_date ? cur.firstDue : r.due_date,
    });
  }
  // Venda recorrente: o valor da venda é a mensalidade definida no fechamento
  // (guardada no cliente), mesmo que a oportunidade não tenha valor estimado.
  type ClosedRow = { id: string; estimated_value: number | null; closed_at: string; won_client_id: string | null; deal_type: string | null; crm_companies: { name: string } | { name: string }[] | null };
  const closedOppList = (closedOppRows as unknown as ClosedRow[] | null) ?? [];
  const wonClientIds = Array.from(new Set(closedOppList.map((o) => o.won_client_id).filter((x): x is string => !!x)));
  const monthlyByClient = new Map<string, number>();
  if (wonClientIds.length > 0) {
    const { data: wonClients } = await supabase.from("clients").select("id, monthly_value").in("id", wonClientIds);
    for (const c of (wonClients as { id: string; monthly_value: number | null }[] | null) ?? []) {
      if (c.monthly_value && Number(c.monthly_value) > 0) monthlyByClient.set(c.id, Number(c.monthly_value));
    }
  }
  const olympicSettings = readOlympicSettings(targets);
  const mode = olympicMode(olympicSettings);
  const byContracts = mode === "contratos";
  const monthSales = monthlySales({
    month,
    countWithoutValue: byContracts,
    closedOpps: closedOppList.map((o) => ({
      id: o.id,
      company: oneRel(o.crm_companies)?.name ?? "Cliente",
      value: o.estimated_value === null ? null : Number(o.estimated_value),
      monthlyValue: o.won_client_id ? (monthlyByClient.get(o.won_client_id) ?? null) : null,
      isRecurring: o.deal_type === "recorrencia",
      closedAt: o.closed_at,
    })),
    receivableSales: Array.from(saleGroups.values()),
  });
  const sumBy = (pred: (e: (typeof monthSales)[number]) => boolean) => monthSales.filter(pred).reduce((x, e) => x + e.value, 0);
  const countBy = (pred: (e: (typeof monthSales)[number]) => boolean) => monthSales.filter(pred).length;
  const olympic = activeOlympicTargets(olympicSettings);
  const olympicValue = mode === "contratos" ? countBy(isContract) : sumBy(() => true);
  const olympicBreakdown =
    mode === "contratos"
      ? [
          { label: "Fechamentos no CRM", value: countBy((e) => e.source === "crm") },
          { label: "Vendas avulsas", value: countBy((e) => e.source === "servico") },
        ]
      : [
          { label: "Fechamentos no CRM", value: sumBy((e) => e.source === "crm") },
          { label: "Vendas avulsas", value: sumBy((e) => e.source === "servico") },
          { label: "Comissões de fornecedores", value: sumBy((e) => e.source === "comissao") },
        ];
  const [oy, om] = month.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(oy, om - 1, 1, 12)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  const stages = (stagesRes.data as { id: string; name: string; position: number; pipeline_id: string; role: string | null; kind: string }[] | null) ?? [];
  const pipelines = (pipelinesRes.data as { id: string; name: string }[] | null) ?? [];
  const members = new Map(((membersRes.data as { id: string; full_name: string }[] | null) ?? []).map((m) => [m.id, m.full_name]));

  const open = (openRes.data as { stage_id: string; estimated_value: number | null }[] | null) ?? [];
  const closed = (closedRes.data as { estimated_value: number | null; acquisition_channel: string | null; event_name: string | null; responsible_id: string | null; created_at: string; closed_at: string }[] | null) ?? [];
  const lost = (lostRes.data as { loss_reason: string | null }[] | null) ?? [];
  const overdue = (overdueRes.data as { responsible_id: string | null }[] | null) ?? [];
  const history = (historyRes.data as { opportunity_id: string; to_stage_id: string | null; changed_at: string }[] | null) ?? [];

  // Propostas apresentadas = oportunidades que entraram numa etapa de
  // diagnóstico/proposta no período (única fonte: o fluxo).
  const proposalStageIds = new Set(stages.filter((s) => s.role === "diagnostico_proposta").map((s) => s.id));
  const proposalsPresented = new Set(history.filter((h) => h.to_stage_id && proposalStageIds.has(h.to_stage_id)).map((h) => h.opportunity_id)).size;

  const revenue = closed.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);
  const conversionBase = closed.length + lost.length;
  const conversion = conversionBase > 0 ? (closed.length / conversionBase) * 100 : 0;
  const avgTicket = closed.length > 0 ? revenue / closed.length : 0;
  // Fechamento = closed_at (corrige o cálculo antigo, que subtraía datas de criação).
  const avgDaysToClose =
    closed.length > 0
      ? closed.reduce((s, o) => s + (new Date(o.closed_at).getTime() - new Date(o.created_at).getTime()) / 86400000, 0) / closed.length
      : 0;
  const inNegotiation = open.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);

  // Vendas por vendedor no período: fechamentos e receita fechada x meta pessoal.
  const salesByMember = new Map<string, { count: number; revenue: number }>();
  for (const o of closed) {
    if (!o.responsible_id) continue;
    const cur = salesByMember.get(o.responsible_id) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(o.estimated_value ?? 0);
    salesByMember.set(o.responsible_id, cur);
  }
  const memberList = ((membersRes.data as { id: string; full_name: string }[] | null) ?? [])
    .filter((m) => (crm.canSeeAll ? true : m.id === crm.teamMemberId));
  const sellerRows = memberList
    .map((m) => ({
      id: m.id,
      name: m.full_name,
      count: salesByMember.get(m.id)?.count ?? 0,
      revenue: salesByMember.get(m.id)?.revenue ?? 0,
      goalCount: memberGoals[m.id]?.fechamentos !== undefined ? memberGoals[m.id].fechamentos! * factor : null,
      goalRevenue: memberGoals[m.id]?.receita_fechada !== undefined ? memberGoals[m.id].receita_fechada! * factor : null,
    }))
    .sort((a, b) => (byContracts ? b.count - a.count || b.revenue - a.revenue : b.revenue - a.revenue || b.count - a.count));
  const teamGoalCount = (targets.fechamentos ?? 3) * factor;
  const teamGoalRevenue = (targets.receita_fechada ?? 15000) * factor;

  const cards: { key: string | null; label: string; value: number; unit: "count" | "money" | "percent" | "days"; note?: string }[] = [
    { key: "leads_recebidos", label: "Leads recebidos", value: leadsPeriod.count ?? 0, unit: "count" },
    { key: null, label: "Leads novos hoje", value: leadsToday.count ?? 0, unit: "count" },
    { key: null, label: "Oportunidades abertas", value: open.length, unit: "count", note: "agora" },
    { key: null, label: "Reuniões agendadas", value: meetingsScheduled.count ?? 0, unit: "count", note: "agora" },
    { key: "reunioes_realizadas", label: "Reuniões realizadas", value: meetingsDone.count ?? 0, unit: "count" },
    { key: "propostas_apresentadas", label: "Propostas apresentadas", value: proposalsPresented, unit: "count" },
    { key: null, label: "Valor em negociação", value: inNegotiation, unit: "money", note: "agora" },
    { key: "fechamentos", label: "Negócios fechados", value: closed.length, unit: "count" },
    { key: "receita_fechada", label: "Receita fechada", value: revenue, unit: "money" },
    { key: "taxa_conversao", label: "Taxa de conversão", value: conversion, unit: "percent" },
    { key: "ticket_medio", label: "Ticket médio", value: avgTicket, unit: "money" },
    { key: "tempo_medio_fechar", label: "Tempo médio até fechar", value: avgDaysToClose, unit: "days" },
    { key: "tarefas_atrasadas", label: "Tarefas atrasadas", value: overdue.length, unit: "count", note: "agora" },
  ];
  // Vendas e fechamentos primeiro; as métricas de atividade vêm depois.
  const SALES_FIRST = ["fechamentos", "receita_fechada", "ticket_medio", "taxa_conversao", "tempo_medio_fechar"];
  // Fluxo enxuto (sem etapa de proposta): o cartão "Propostas apresentadas" ficaria sempre zerado, então sai.
  const visibleCards = cards
    .filter((c) => c.key !== "propostas_apresentadas" || proposalStageIds.size > 0)
    // Meta por contratos: sem valores (receita, ticket médio e valor em negociação saem).
    .filter((c) => !byContracts || !(c.key === "receita_fechada" || c.key === "ticket_medio" || c.label === "Valor em negociação"))
    .map((c) => (byContracts && c.key === "fechamentos" ? { ...c, label: "Contratos fechados" } : c));
  visibleCards.sort((a, b) => {
    const ra = a.key && SALES_FIRST.includes(a.key) ? SALES_FIRST.indexOf(a.key) : 99;
    const rb = b.key && SALES_FIRST.includes(b.key) ? SALES_FIRST.indexOf(b.key) : 99;
    return ra - rb;
  });

  // Fluxo atual por etapa (aberto), por pipeline.
  const funnelCount = new Map<string, { count: number; value: number }>();
  for (const o of open) {
    const cur = funnelCount.get(o.stage_id) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(o.estimated_value ?? 0);
    funnelCount.set(o.stage_id, cur);
  }

  // Conversão etapa a etapa e tempo em cada etapa, dentro do período.
  const passed = new Map<string, Set<string>>();
  const byOpp = new Map<string, typeof history>();
  for (const h of history) {
    if (h.to_stage_id) {
      const set = passed.get(h.to_stage_id) ?? new Set<string>();
      set.add(h.opportunity_id);
      passed.set(h.to_stage_id, set);
    }
    const list = byOpp.get(h.opportunity_id) ?? [];
    list.push(h);
    byOpp.set(h.opportunity_id, list);
  }
  const durations = new Map<string, number[]>();
  for (const list of byOpp.values()) {
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      if (!cur.to_stage_id) continue;
      const next = list[i + 1];
      const endMs = next ? new Date(next.changed_at).getTime() : Date.now();
      const arr = durations.get(cur.to_stage_id) ?? [];
      arr.push((endMs - new Date(cur.changed_at).getTime()) / 86400000);
      durations.set(cur.to_stage_id, arr);
    }
  }

  const byChannel = countMap(closed, (o) =>
    o.acquisition_channel === "Evento" && o.event_name ? `Evento: ${o.event_name}` : (o.acquisition_channel ?? "Não informado")
  );
  const bySeller = countMap(closed, (o) => (o.responsible_id ? members.get(o.responsible_id) ?? "—" : "Sem responsável"));
  const lossReasons = countMap(lost, (o) => o.loss_reason ?? "Não informado");
  const overdueByRep = countMap(overdue, (t) => (t.responsible_id ? members.get(t.responsible_id) ?? "—" : "Sem responsável"));

  type RawToday = { id: string; due_at: string; crm_opportunities: { crm_companies: { name: string } | { name: string }[] | null } | { crm_companies: { name: string } | { name: string }[] | null }[] | null };
  const agenda = ((todayTasksRes.data as unknown as RawToday[]) ?? []).map((t) => ({
    id: t.id,
    due_at: t.due_at,
    companyName: one(one(t.crm_opportunities)?.crm_companies)?.name ?? "—",
  }));

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${active ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-ink"}`;

  return (
    <div>
      {access.isFullAdmin && (
      <OlympicCard
        scope={access.workspaceId ?? ""}
        month={month}
        monthLabel={monthLabel}
        isCurrentMonth={month === currentMonthKey}
        mode={mode}
        targets={olympic}
        progressValue={olympicValue}
        breakdown={olympicBreakdown}
        sales={monthSales}
        periodParam={periodo}
      />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
            <Link key={k} href={`/crm/visao-geral?periodo=${k}&mes=${month}`} className={pill(k === periodo)}>
              {PERIODS[k].label}
            </Link>
          ))}
        </div>
      </div>

      <SalesPanel
        periodLabel={PERIODS[periodo].label}
        team={
          crm.canSeeAll
            ? { count: closed.length, goalCount: teamGoalCount, revenue, goalRevenue: teamGoalRevenue }
            : null
        }
        sellers={sellerRows}
        showRevenue={!byContracts}
      />

      <style>{`
        @keyframes goal-shine { 0% { transform: translateX(-130%) } 100% { transform: translateX(260%) } }
        @keyframes goal-pop { 0% { transform: scale(.96) } 60% { transform: scale(1.03) } 100% { transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) { .goal-card * , .goal-card { animation: none !important } }
      `}</style>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleCards.map((c) => {
          const def = GOAL_METRICS.find((m) => m.key === c.key);
          const base = def ? (targets[def.key] ?? def.fallback) : null;
          const target = def && base !== null ? (def.scales ? base * factor : base) : null;
          const hasGoal = !!def && target !== null && target > 0;
          const toneKey = def && target !== null ? classifyGoal(c.value, target, def.direction) : null;
          const tone = toneKey ? GOAL_TONE_CLASSES[toneKey] : null;
          const hit = hasGoal && toneKey === "green";
          const box = !hasGoal
            ? "border-border bg-surface"
            : toneKey === "green"
              ? "border-emerald-500 bg-emerald-50 shadow-[0_6px_20px_rgba(16,185,129,0.25)]"
              : toneKey === "yellow"
                ? "border-amber-300 bg-amber-50/60"
                : "border-red-300 bg-red-50/60";
          const badge = !hasGoal
            ? null
            : toneKey === "green"
              ? { text: "✓ Meta batida", cls: "bg-emerald-600 text-white" }
              : toneKey === "yellow"
                ? { text: "Quase lá", cls: "bg-amber-200 text-amber-900" }
                : { text: def!.direction === "lower" ? "Acima do limite" : "Abaixo da meta", cls: "bg-red-100 text-red-800" };
          return (
            <div
              key={c.label}
              className={`goal-card relative overflow-hidden rounded-xl border-2 p-4 ${box}`}
              style={hit ? { animation: "goal-pop .5s ease-out both" } : undefined}
            >
              {hit && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/60"
                  style={{ animation: "goal-shine 1.8s ease-in-out .3s 1 both" }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-xs text-muted">{c.label}</p>
                {tone && <span className={`h-2.5 w-2.5 rounded-full ${tone.bar}`} aria-hidden />}
              </div>
              <p className={`relative mt-1 font-display text-lg ${tone ? tone.text : "text-ink"} ${hit ? "text-2xl font-semibold" : ""}`}>{format(c.unit, c.value)}</p>
              {def && target !== null ? (
                <p className="relative text-[11px] text-muted">
                  meta {def.direction === "lower" ? "≤ " : ""}
                  {format(c.unit, target)}
                </p>
              ) : (
                c.note && <p className="relative text-[11px] text-muted">{c.note}</p>
              )}
              {badge && (
                <span className={`relative mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>
                  {badge.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BarBlock
          title="Fluxo por etapa (aberto agora)"
          hint="Quantidade de oportunidades abertas em cada etapa (o valor aparece ao passar o mouse)."
          empty="Nenhuma oportunidade aberta."
          data={pipelines.flatMap((p) =>
            stages
              .filter((st) => st.pipeline_id === p.id)
              .map((st): ChartDatum => {
                const f = funnelCount.get(st.id);
                return {
                  name: pipelines.length > 1 ? `${p.name} · ${st.name}` : st.name,
                  value: f?.count ?? 0,
                  extra: money(f?.value ?? 0),
                };
              })
          )}
        />

        <BarBlock
          title="Conversão etapa a etapa"
          hint="Oportunidades que entraram em cada etapa no período."
          empty="Sem etapas."
          data={stages.filter((st) => st.kind === "open").map((st): ChartDatum => ({ name: st.name, value: passed.get(st.id)?.size ?? 0 }))}
        />

        <BarBlock
          title="Tempo médio em cada etapa"
          hint="Em dias, dos movimentos do período."
          empty="Sem etapas."
          unit="d"
          data={stages
            .filter((st) => st.kind === "open")
            .map((st): ChartDatum => {
              const d = durations.get(st.id) ?? [];
              return { name: st.name, value: Number((d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0).toFixed(1)) };
            })}
        />

        <Block title="Agenda do dia">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma tarefa pra hoje.</p>
          ) : (
            agenda.map((t) => (
              <Row key={t.id} label={t.companyName} value={new Date(t.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} />
            ))
          )}
        </Block>

        <PieBlock
          title="Vendas por canal de aquisição"
          empty="Nenhuma venda fechada no período."
          data={byChannel.map(([name, value]) => ({ name, value }))}
        />

        <BarBlock
          title="Ranking de vendedores"
          hint="Vendas fechadas no período."
          empty="Nenhuma venda fechada no período."
          data={bySeller.map(([name, value]) => ({ name, value }))}
        />

        <PieBlock
          title="Motivos de perda mais frequentes"
          empty="Nenhuma oportunidade perdida no período."
          data={lossReasons.map(([name, value]) => ({ name, value }))}
        />

        <BarBlock
          title="Tarefas atrasadas por vendedor"
          empty="Nenhuma tarefa atrasada."
          data={overdueByRep.map(([name, value]) => ({ name, value }))}
        />

      </div>
    </div>
  );
}
