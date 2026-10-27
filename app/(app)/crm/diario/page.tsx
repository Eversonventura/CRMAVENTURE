import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { getCrmAccessContext } from "../lib";
import { brtToday, brtWeek, daysOverdue } from "./dates";
import { addDays } from "./off-days";
import { ensureDailyPicks } from "./picks";
import { leadGaps } from "../lead-completeness";
import { DiarioView, type DiarioData, type DiarioTask } from "./DiarioView";
import type { TeamMemberOption } from "../types";

const DEFAULT_APPROACH_GOAL = 10;
const FOLLOWUP_ROLES = ["tentativa", "contato", "standby", "briefing", "diagnostico_proposta", "negociacao"] as const;
const TEMP_RANK: Record<string, number> = { quente: 0, morno: 1, frio: 2 };

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

type RawTask = {
  id: string;
  opportunity_id: string;
  type: DiarioTask["type"];
  responsible_id: string | null;
  due_at: string;
  priority: string | null;
  description: string | null;
  status: DiarioTask["status"];
  activity_result: string | null;
  created_at: string;
  source: DiarioTask["source"];
  stage_id: string | null;
  crm_stages: { name: string; role: string | null } | { name: string; role: string | null }[] | null;
  crm_opportunities:
    | { status: string; temperature: string | null; estimated_value: number | null; crm_companies: { name: string } | { name: string }[] | null; crm_contacts: { whatsapp: string | null; phone: string | null } | { whatsapp: string | null; phone: string | null }[] | null }
    | { status: string; temperature: string | null; estimated_value: number | null; crm_companies: { name: string } | { name: string }[] | null; crm_contacts: { whatsapp: string | null; phone: string | null } | { whatsapp: string | null; phone: string | null }[] | null }[]
    | null;
};

export default async function CrmDiarioPage({ searchParams }: { searchParams: Promise<{ pessoa?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [crm, access, { data: teamMembers }] = await Promise.all([
    getCrmAccessContext(),
    getAccessContext(),
    supabase.rpc("team_member_picker_options"),
  ]);
  const members = (teamMembers as TeamMemberOption[] | null) ?? [];

  const requested = sp.pessoa && members.some((m) => m.id === sp.pessoa) ? sp.pessoa : null;
  const personId = crm.canSeeAll ? (requested ?? crm.teamMemberId ?? members[0]?.id ?? null) : crm.teamMemberId;

  if (!personId) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        Seu usuário não está vinculado a um membro da equipe — peça a um administrador para vincular.
      </p>
    );
  }

  const { date, startIso, endIso, isBusinessDay, overdueCutoffIso } = brtToday();
  // Performance: o Supabase fica em Oregon e cada ida e volta custa — tudo que não
  // depende de outra consulta roda junto (antes eram ~10 consultas em fila).
  const [{ data: offRows }, { data: goalRow }, { data: weeklyRow }] = await Promise.all([
    supabase
      .from("crm_off_days")
      .select("off_date, reason")
      .eq("responsible_id", personId)
      .gte("off_date", brtWeek(date).monday)
      .order("off_date")
      .limit(80),
    supabase.from("crm_goals").select("target").eq("metric", "daily_approaches").is("owner_id", null).maybeSingle(),
    supabase.from("crm_goals").select("target").eq("metric", "weekly_new_leads").is("owner_id", null).maybeSingle(),
  ]);
  const allOff = ((offRows as { off_date: string; reason: string | null }[] | null) ?? []).map((o) => ({ date: o.off_date, reason: o.reason }));
  const offSet = new Set(allOff.map((o) => o.date));
  const offDays = allOff.filter((o) => o.date >= date);
  const offToday = offDays.some((o) => o.date === date);
  const mine = `responsible_id.eq.${personId},responsible_id.is.null`;
  const approachGoal = goalRow ? Number(goalRow.target) : DEFAULT_APPROACH_GOAL;
  const weeklyBase = weeklyRow ? Number(weeklyRow.target) : approachGoal * 5;

  // Sem prospecção no fim de semana: não sorteia abordagens.
  const ensurePicks: Promise<void> =
    isBusinessDay && !offToday ? ensureDailyPicks(supabase, personId, date, approachGoal) : Promise.resolve();

  const TASK_SELECT =
    "id, opportunity_id, type, responsible_id, due_at, priority, description, status, activity_result, created_at, source, stage_id, crm_stages(name, role), crm_opportunities(status, temperature, estimated_value, crm_companies(name), crm_contacts(whatsapp, phone))";

  const week = brtWeek(date);
  const showEnrich = !isBusinessDay || offToday;
  const [picksRes, approachedRes, tasksRes, doneRes, rulesRes, mesaRes, closedRes, addedRes, stockRes, stageRowsRes, enrichRes] = await Promise.all([
    // as abordagens do dia precisam existir antes de serem lidas; o resto não espera por isso
    ensurePicks.then(() =>
    supabase
      .from("crm_daily_picks")
      .select(
        "opportunity_id, created_at, crm_opportunities(temperature, first_contact_at, crm_companies(name, instagram), crm_contacts(name, phone, whatsapp), crm_stages(role, name))"
      )
      .eq("pick_date", date)
      .eq("responsible_id", personId)
      .eq("dismissed", false)
      .order("created_at")),
    supabase
      .from("crm_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("responsible_id", personId)
      .gte("first_contact_at", startIso),
    supabase
      .from("crm_tasks")
      .select(TASK_SELECT)
      .eq("status", "pendente")
      .or(mine)
      .order("due_at")
      .limit(500),
    supabase
      .from("crm_tasks")
      .select("stage_id")
      .eq("status", "concluida")
      .eq("source", "followup")
      .eq("responsible_id", personId)
      .gte("completed_at", startIso)
      .limit(500),
    supabase
      .from("crm_followup_rules")
      .select("stage_id, daily_goal, active, crm_stages(name, role, color)"),
    supabase
      .from("crm_opportunities")
      .select("id, estimated_value, temperature, responsible_id, crm_companies(name), crm_contacts(whatsapp, phone), crm_stages!inner(name, color, role)")
      .eq("status", "aberta")
      .in("crm_stages.role", ["briefing", "diagnostico_proposta", "negociacao"])
      .or(mine)
      .limit(100),
    supabase
      .from("crm_opportunities")
      .select(
        "id, status, estimated_value, closed_at, lost_at, loss_reason, loss_details, crm_companies(name), crm_contacts(whatsapp, phone)"
      )
      .or(`closed_at.gte.${startIso},lost_at.gte.${startIso}`)
      .or(mine)
      .limit(100),
    supabase
      .from("crm_opportunities")
      .select("id", { count: "exact", head: true })
      .gte("created_at", week.startIso)
      .lt("created_at", week.endIso),
    supabase
      .from("crm_opportunities")
      .select("id, crm_stages!inner(role)", { count: "exact", head: true })
      .eq("status", "aberta")
      .eq("crm_stages.role", "lead")
      .is("first_contact_at", null)
      .or(mine),
    supabase.from("crm_stages").select("id, name, position, pipeline_id, kind").eq("kind", "open").order("position"),
    // Completar leads: só em fim de semana / dia sem prospecção (evita carga à toa).
    showEnrich
      ? supabase
          .from("crm_opportunities")
          .select(
            "id, temperature, created_at, enrichment_checked_at, crm_stages!inner(role), crm_companies(name, instagram, website, google_business_url, postal_code), crm_contacts(name, whatsapp, phone)"
          )
          .eq("status", "aberta")
          .eq("crm_stages.role", "lead")
          .is("enrichment_checked_at", null)
          .or(mine)
          .limit(500)
      : Promise.resolve({ data: null }),
  ]);

  // Tarefas pendentes → atrasadas / de hoje / próxima ação de cada oportunidade.
  const allPending: DiarioTask[] = ((tasksRes.data as unknown as RawTask[]) ?? [])
    .filter((t) => one(t.crm_opportunities)?.status === "aberta")
    .map((t) => {
      const opp = one(t.crm_opportunities);
      const stage = one(t.crm_stages);
      return {
        id: t.id,
        opportunity_id: t.opportunity_id,
        type: t.type,
        responsible_id: t.responsible_id,
        due_at: t.due_at,
        priority: t.priority,
        description: t.description,
        status: t.status,
        activity_result: t.activity_result,
        created_at: t.created_at,
        source: t.source,
        stage_id: t.stage_id,
        stageName: stage?.name ?? null,
        stageRole: stage?.role ?? null,
        companyName: one(opp?.crm_companies)?.name ?? "—",
        whatsapp: one(opp?.crm_contacts)?.whatsapp ?? one(opp?.crm_contacts)?.phone ?? null,
        responsibleName: null,
        temperature: opp?.temperature ?? null,
        value: opp?.estimated_value ?? null,
        overdueDays: new Date(t.due_at) < new Date(overdueCutoffIso) ? daysOverdue(t.due_at, overdueCutoffIso) : 0,
      };
    });

  const overdue = allPending.filter((t) => t.overdueDays > 0);
  const todayTasks = allPending.filter((t) => t.overdueDays === 0 && t.due_at < endIso);
  const prio = (a: DiarioTask, b: DiarioTask) =>
    (TEMP_RANK[a.temperature ?? ""] ?? 3) - (TEMP_RANK[b.temperature ?? ""] ?? 3) ||
    (b.value ?? 0) - (a.value ?? 0) ||
    a.due_at.localeCompare(b.due_at);

  // Metas por papel de etapa (várias etapas com o mesmo papel dividem a meta).
  type RawRule = {
    stage_id: string;
    daily_goal: number | null;
    active: boolean;
    crm_stages: { name: string; role: string | null; color: string | null } | { name: string; role: string | null; color: string | null }[] | null;
  };
  const rules = (rulesRes.data as unknown as RawRule[]) ?? [];
  const goalByRole = new Map<string, number | null>();
  const stagesByRole = new Map<string, { stageId: string; name: string; goal: number | null }[]>();
  for (const r of rules) {
    const st = one(r.crm_stages);
    if (!st?.role) continue;
    const list = stagesByRole.get(st.role) ?? [];
    list.push({ stageId: r.stage_id, name: st.name, goal: r.daily_goal });
    stagesByRole.set(st.role, list);
    if (r.active && r.daily_goal !== null) goalByRole.set(st.role, Math.max(goalByRole.get(st.role) ?? 0, r.daily_goal));
  }
  const roleOfStage = new Map<string, string>();
  for (const [role, list] of stagesByRole) for (const s of list) roleOfStage.set(s.stageId, role);
  const doneByRole = new Map<string, number>();
  for (const d of (doneRes.data as { stage_id: string | null }[]) ?? []) {
    const role = d.stage_id ? roleOfStage.get(d.stage_id) : undefined;
    if (role) doneByRole.set(role, (doneByRole.get(role) ?? 0) + 1);
  }

  const followupColumns = FOLLOWUP_ROLES.map((role) => ({
    role,
    goal: goalByRole.get(role) ?? null,
    done: doneByRole.get(role) ?? 0,
    tasks: todayTasks.filter((t) => t.source === "followup" && t.stageRole === role).sort(prio),
  })).filter((c) => c.tasks.length > 0 || c.goal !== null || c.done > 0);

  const prepTasks = todayTasks
    .filter((t) => !(t.source === "followup" && t.stageRole && (FOLLOWUP_ROLES as readonly string[]).includes(t.stageRole)))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  // Próxima ação por oportunidade (tarefa pendente mais próxima).
  const nextActionByOpp = new Map<string, DiarioTask>();
  for (const t of allPending) if (!nextActionByOpp.has(t.opportunity_id)) nextActionByOpp.set(t.opportunity_id, t);

  type RawPick = {
    opportunity_id: string;
    crm_opportunities:
      | {
          temperature: string | null;
          first_contact_at: string | null;
          crm_companies: { name: string; instagram: string | null } | { name: string; instagram: string | null }[] | null;
          crm_contacts: { name: string; phone: string | null; whatsapp: string | null } | { name: string; phone: string | null; whatsapp: string | null }[] | null;
          crm_stages: { role: string | null; name: string } | { role: string | null; name: string }[] | null;
        }
      | null
      | unknown[];
  };
  const picks = ((picksRes.data as unknown as RawPick[]) ?? []).map((p) => {
    const opp = one(p.crm_opportunities as never) as {
      temperature: string | null;
      first_contact_at: string | null;
      crm_companies: { name: string; instagram: string | null } | { name: string; instagram: string | null }[] | null;
      crm_contacts: { name: string; phone: string | null; whatsapp: string | null } | { name: string; phone: string | null; whatsapp: string | null }[] | null;
      crm_stages: { role: string | null; name: string } | { role: string | null; name: string }[] | null;
    } | null;
    const company = one(opp?.crm_companies);
    const contact = one(opp?.crm_contacts);
    const stage = one(opp?.crm_stages);
    return {
      opportunityId: p.opportunity_id,
      companyName: company?.name ?? "—",
      contactName: contact?.name ?? null,
      whatsapp: contact?.whatsapp ?? contact?.phone ?? null,
      instagram: company?.instagram ?? null,
      temperature: opp?.temperature ?? null,
      approached: !!opp?.first_contact_at || (stage?.role ?? "lead") !== "lead",
      stageName: stage?.name ?? null,
    };
  });

  type RawMesa = {
    id: string;
    estimated_value: number | null;
    temperature: string | null;
    crm_companies: { name: string } | { name: string }[] | null;
    crm_contacts: { whatsapp: string | null; phone: string | null } | { whatsapp: string | null; phone: string | null }[] | null;
    crm_stages: { name: string; color: string | null; role: string | null } | { name: string; color: string | null; role: string | null }[] | null;
  };
  const mesa = ((mesaRes.data as unknown as RawMesa[]) ?? []).map((o) => {
    const next = nextActionByOpp.get(o.id) ?? null;
    return {
      opportunityId: o.id,
      companyName: one(o.crm_companies)?.name ?? "—",
      whatsapp: one(o.crm_contacts)?.whatsapp ?? one(o.crm_contacts)?.phone ?? null,
      stageName: one(o.crm_stages)?.name ?? "—",
      stageColor: one(o.crm_stages)?.color ?? "#64748B",
      value: o.estimated_value,
      temperature: o.temperature,
      nextType: next?.type ?? null,
      nextDueAt: next?.due_at ?? null,
      nextText: next?.description ?? null,
    };
  });
  mesa.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  type RawClosed = {
    id: string;
    status: string;
    estimated_value: number | null;
    closed_at: string | null;
    lost_at: string | null;
    loss_reason: string | null;
    loss_details: string | null;
    crm_companies: { name: string } | { name: string }[] | null;
    crm_contacts: { whatsapp: string | null; phone: string | null } | { whatsapp: string | null; phone: string | null }[] | null;
  };
  const closed = ((closedRes.data as unknown as RawClosed[]) ?? [])
    .filter((o) => (o.status === "fechada" && o.closed_at && o.closed_at >= startIso) || (o.status === "perdida" && o.lost_at && o.lost_at >= startIso))
    .map((o) => ({
      opportunityId: o.id,
      companyName: one(o.crm_companies)?.name ?? "—",
      whatsapp: one(o.crm_contacts)?.whatsapp ?? one(o.crm_contacts)?.phone ?? null,
      won: o.status === "fechada",
      value: o.estimated_value,
      lossReason: o.loss_reason,
      lossDetails: o.loss_details,
    }));

  // Completar leads (consulta já feita junto das demais, só em fim de semana / dia sem prospecção).
  let enrich: DiarioData["enrich"] = null;
  if (showEnrich) {
    const leadRows = enrichRes.data;
    type RawLead = {
      id: string;
      temperature: string | null;
      created_at: string;
      crm_companies: { name: string; instagram: string | null; website: string | null; google_business_url: string | null; postal_code: string | null } | { name: string; instagram: string | null; website: string | null; google_business_url: string | null; postal_code: string | null }[] | null;
      crm_contacts: { name: string; whatsapp: string | null; phone: string | null } | { name: string; whatsapp: string | null; phone: string | null }[] | null;
    };
    const incomplete = ((leadRows as unknown as RawLead[]) ?? [])
      .map((l) => {
        const company = one(l.crm_companies);
        const contact = one(l.crm_contacts);
        const gaps = leadGaps({
          whatsapp: contact?.whatsapp ?? null,
          phone: contact?.phone ?? null,
          instagram: company?.instagram ?? null,
          website: company?.website ?? null,
          googleBusinessUrl: company?.google_business_url ?? null,
          postalCode: company?.postal_code ?? null,
        });
        return {
          opportunityId: l.id,
          companyName: company?.name ?? "—",
          contactName: contact?.name ?? null,
          temperature: l.temperature,
          created_at: l.created_at,
          ...gaps,
        };
      })
      .filter((l) => l.incomplete)
      // faltam os dois (mais crítico) primeiro, depois quentes, depois mais antigos
      .sort(
        (a, b) =>
          b.missingRequired.length - a.missingRequired.length ||
          (TEMP_RANK[a.temperature ?? ""] ?? 3) - (TEMP_RANK[b.temperature ?? ""] ?? 3) ||
          a.created_at.localeCompare(b.created_at)
      );
    enrich = {
      total: incomplete.length,
      items: incomplete.slice(0, 40).map((l) => ({
        opportunityId: l.opportunityId,
        companyName: l.companyName,
        contactName: l.contactName,
        missingRequired: l.missingRequired,
        missingOptional: l.missingOptional,
      })),
    };
  }

  // Abastecer o funil: meta semanal de leads novos, estoque de leads sem
  // abordagem e quanto falta pra semana que vem.
  const workdaysThisWeek = week.weekdays.filter((d) => !offSet.has(d)).length;
  const nextWeekdays = week.weekdays.map((d) => addDays(d, 7));
  const nextWeekWorkdays = nextWeekdays.filter((d) => !offSet.has(d)).length;
  const addedThisWeek = addedRes.count;
  const stockCount = stockRes.count;
  const stock = stockCount ?? 0;
  const supply = {
    weeklyBase,
    weeklyGoal: Math.round((weeklyBase * workdaysThisWeek) / 5),
    workdaysThisWeek,
    added: addedThisWeek ?? 0,
    stock,
    perDay: approachGoal,
    stockDays: approachGoal > 0 ? Math.floor(stock / approachGoal) : 0,
    nextWeekNeed: approachGoal * nextWeekWorkdays,
    nextWeekWorkdays,
    shortage: Math.max(0, approachGoal * nextWeekWorkdays - stock),
  };

  // Etapas abertas do funil, pra escolher o destino ao registrar uma abordagem.
  const stageRowsAll = stageRowsRes.data;
  const firstPipelineId = (stageRowsAll as { pipeline_id: string }[] | null)?.[0]?.pipeline_id;
  const stageOptions = ((stageRowsAll as { id: string; name: string; pipeline_id: string }[] | null) ?? [])
    .filter((st) => st.pipeline_id === firstPipelineId)
    .map((st) => ({ id: st.id, name: st.name }));

  const stageGoalEditors = FOLLOWUP_ROLES.flatMap((role) => stagesByRole.get(role) ?? []);

  const data: DiarioData = {
    personId,
    people: crm.canSeeAll ? members.map((m) => ({ id: m.id, name: m.full_name })) : [],
    date,
    weekend: !isBusinessDay,
    offToday,
    offDays,
    enrich,
    supply,
    stageOptions,
    canEditGoals: access.isFullAdmin,
    approach: { goal: approachGoal, done: approachedRes.count ?? 0, picks },
    overdue,
    followupColumns,
    prepTasks,
    mesa,
    closed,
    goalEditors: { stages: stageGoalEditors, weeklyLeads: weeklyBase },
  };

  return <DiarioView data={data} teamMembers={members} />;
}
