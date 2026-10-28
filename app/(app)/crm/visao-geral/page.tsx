import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { getCrmAccessContext } from "../lib";
import { brtToday } from "../diario/dates";
import { classifyGoal, GOAL_METRICS, GOAL_TONE_CLASSES } from "../goals";
import { GoalsEditor } from "../GoalsEditor";
import type { SalesGoalMap } from "../sales-goals";
import { OlympicCard } from "./OlympicCard";
import { olympicTargets, readOlympicSettings } from "../olympic";

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
}: {
  periodLabel: string;
  team: { count: number; goalCount: number; revenue: number; goalRevenue: number } | null;
  sellers: { id: string; name: string; count: number; revenue: number; goalCount: number | null; goalRevenue: number | null }[];
}) {
  return (
    <section className="mb-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-base font-medium text-ink">Vendas e fechamentos</h2>
      <p className="mt-0.5 text-xs text-muted">{periodLabel} · negócios que chegaram a Fechado e a receita deles, contra a meta.</p>

      {team && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Fechamentos da equipe", value: team.count, goal: team.goalCount, text: `${team.count} de ${Math.round(team.goalCount)}` },
            { label: "Receita fechada da equipe", value: team.revenue, goal: team.goalRevenue, text: `${money(team.revenue)} de ${money(team.goalRevenue)}` },
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
              <th className="py-2 pr-4 font-normal">Fechamentos</th>
              <th className="py-2 font-normal">Receita fechada</th>
            </tr>
          </thead>
          <tbody>
            {sellers.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-muted">Nenhuma pessoa na conta.</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">Metas pessoais definidas em Metas → Metas de vendas por vendedor.</p>
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
    recRes,
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
      .select("kind, client_id, sale_id, amount, status, paid_at, due_date, installment_number, sale_total, created_at")
      .limit(2000),
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

  // --- Meta olímpica: dinheiro NOVO recebido no mês (regime de caixa) ---
  const { data: recRows } = recRes;
  const inMonth = (d: string | null | undefined) => !!d && d.slice(0, 7) === month;
  const receivables = (recRows as { kind: string; client_id: string | null; sale_id: string; due_date: string; amount: number; status: string; paid_at: string | null; installment_number: number; sale_total: number; created_at: string }[] | null) ?? [];
  const projetos = receivables.filter((r) => r.kind === "projeto" && r.status === "paid" && inMonth(r.paid_at)).reduce((x, r) => x + Number(r.amount), 0);
  const comissoes = receivables.filter((r) => r.kind === "comissao" && r.status === "paid" && inMonth(r.paid_at)).reduce((x, r) => x + Number(r.amount), 0);
  // 1ª mensalidade conta pelas parcelas recebidas.
  const primeirasParcelas = receivables.filter((r) => r.kind === "primeira_mensalidade" && r.status === "paid" && inMonth(r.paid_at)).reduce((x, r) => x + Number(r.amount), 0);
  // "Vendido no mês" = vendas cuja 1ª parcela vence no mês (a data da venda, não a do
  // cadastro no sistema — uma venda de setembro lançada em outubro continua sendo de setembro).
  const saleDates = new Map<string, { total: number; first: string }>();
  for (const r of receivables) {
    const cur = saleDates.get(r.sale_id);
    saleDates.set(r.sale_id, { total: Number(r.sale_total), first: cur && cur.first < r.due_date ? cur.first : r.due_date });
  }
  const sold = Array.from(saleDates.values()).filter((v) => v.first.slice(0, 7) === month).reduce((x, v) => x + v.total, 0);

  const primeirasMensalidades = primeirasParcelas;
  const newMoney = projetos + comissoes + primeirasMensalidades;
  const olympicSettings = readOlympicSettings(targets);
  const olympic = olympicTargets(olympicSettings);
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
  // diagnóstico/proposta no período (única fonte: o funil).
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
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
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
  cards.sort((a, b) => {
    const ra = a.key && SALES_FIRST.includes(a.key) ? SALES_FIRST.indexOf(a.key) : 99;
    const rb = b.key && SALES_FIRST.includes(b.key) ? SALES_FIRST.indexOf(b.key) : 99;
    return ra - rb;
  });

  // Funil atual por etapa (aberto), por pipeline.
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
        month={month}
        monthLabel={monthLabel}
        isCurrentMonth={month === currentMonthKey}
        targets={olympic}
        newMoney={newMoney}
        breakdown={[
          { label: "Projetos (parcelas recebidas)", value: projetos },
          { label: "Comissões de fornecedores", value: comissoes },
          { label: "1ª mensalidade de cliente novo", value: primeirasMensalidades },
        ]}
        sold={sold}
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
        {access.isFullAdmin && (
          <GoalsEditor
            targets={targets}
            olympic={olympicSettings}
            members={((membersRes.data as { id: string; full_name: string }[] | null) ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
            memberGoals={memberGoals}
          />
        )}
      </div>

      <SalesPanel
        periodLabel={PERIODS[periodo].label}
        team={
          crm.canSeeAll
            ? { count: closed.length, goalCount: teamGoalCount, revenue, goalRevenue: teamGoalRevenue }
            : null
        }
        sellers={sellerRows}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const def = GOAL_METRICS.find((m) => m.key === c.key);
          const base = def ? (targets[def.key] ?? def.fallback) : null;
          const target = def && base !== null ? (def.scales ? base * factor : base) : null;
          const tone = def && target !== null ? GOAL_TONE_CLASSES[classifyGoal(c.value, target, def.direction)] : null;
          return (
            <div key={c.label} className={`rounded-xl border bg-surface p-4 ${tone ? "border-border" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted">{c.label}</p>
                {tone && <span className={`h-2.5 w-2.5 rounded-full ${tone.bar}`} aria-hidden />}
              </div>
              <p className={`mt-1 font-display text-lg ${tone ? tone.text : "text-ink"}`}>{format(c.unit, c.value)}</p>
              {def && target !== null ? (
                <p className="text-[11px] text-muted">
                  meta {def.direction === "lower" ? "≤ " : ""}
                  {format(c.unit, target)}
                </p>
              ) : (
                c.note && <p className="text-[11px] text-muted">{c.note}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Block title="Funil por etapa (aberto agora)">
          {pipelines.map((p) => (
            <div key={p.id} className="space-y-2">
              {pipelines.length > 1 && <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted">{p.name}</p>}
              {stages.filter((s) => s.pipeline_id === p.id).map((s) => {
                const f = funnelCount.get(s.id);
                return <Row key={s.id} label={s.name} value={`${f?.count ?? 0} · ${money(f?.value ?? 0)}`} />;
              })}
            </div>
          ))}
        </Block>

        <Block title="Conversão etapa a etapa" hint="Oportunidades que entraram em cada etapa no período.">
          {stages.filter((s) => s.kind === "open").map((s) => (
            <Row key={s.id} label={s.name} value={passed.get(s.id)?.size ?? 0} />
          ))}
        </Block>

        <Block title="Tempo médio em cada etapa" hint="Dos movimentos do período.">
          {stages.filter((s) => s.kind === "open").map((s) => {
            const d = durations.get(s.id) ?? [];
            const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
            return <Row key={s.id} label={s.name} value={`${avg.toFixed(1)}d`} />;
          })}
        </Block>

        <Block title="Agenda do dia">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma tarefa pra hoje.</p>
          ) : (
            agenda.map((t) => (
              <Row key={t.id} label={t.companyName} value={new Date(t.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} />
            ))
          )}
        </Block>

        <Block title="Vendas por canal de aquisição">
          {byChannel.length === 0 ? <p className="text-sm text-muted">Nenhuma venda fechada no período.</p> : byChannel.map(([n, c]) => <Row key={n} label={n} value={c} />)}
        </Block>

        <Block title="Ranking de vendedores">
          {bySeller.length === 0 ? <p className="text-sm text-muted">Nenhuma venda fechada no período.</p> : bySeller.map(([n, c]) => <Row key={n} label={n} value={c} />)}
        </Block>

        <Block title="Motivos de perda mais frequentes">
          {lossReasons.length === 0 ? <p className="text-sm text-muted">Nenhuma oportunidade perdida no período.</p> : lossReasons.map(([n, c]) => <Row key={n} label={n} value={c} />)}
        </Block>

        <Block title="Tarefas atrasadas por vendedor">
          {overdueByRep.length === 0 ? <p className="text-sm text-muted">Nenhuma tarefa atrasada.</p> : overdueByRep.map(([n, c]) => <Row key={n} label={n} value={c} />)}
        </Block>

      </div>
    </div>
  );
}
