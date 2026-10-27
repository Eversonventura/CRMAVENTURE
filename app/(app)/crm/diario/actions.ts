"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { addManualActivity, moveOpportunityStage, registerContactAttempt } from "../actions";
import { findPipelineStage } from "../stage-lookup";
import type { FunilOpportunityRow } from "../funil/FunilBoard";
import { readCompanyExtra, readDetails } from "../funil/details";
import type { CrmStage } from "../types";
import { brtToday } from "./dates";
import { APPROACH_CHANNELS, type ApproachChannel } from "./approach-channels";
import { addDays, brtDateOf, MEETING_TYPES, planOffDayReschedule } from "./off-days";

type Result = { error?: string };

// "Abordei": se o lead não tem responsável, ele passa a ser de quem abordou;
// depois reaproveita o fluxo de sempre (vai pra Tentativa de contato, o
// trigger grava first_contact_at e a regra da etapa agenda o follow-up).
export async function approachLead(opportunityId: string, personId: string): Promise<Result> {
  const supabase = await createClient();
  await supabase
    .from("crm_opportunities")
    .update({ responsible_id: personId })
    .eq("id", opportunityId)
    .is("responsible_id", null);
  const result = await registerContactAttempt(opportunityId);
  revalidatePath("/crm/diario");
  revalidatePath("/crm/funil");
  revalidatePath("/crm/tarefas");
  return result;
}

export async function swapPick(opportunityId: string, personId: string, pickDate: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_daily_picks")
    .update({ dismissed: true })
    .eq("pick_date", pickDate)
    .eq("responsible_id", personId)
    .eq("opportunity_id", opportunityId);
  if (error) return { error: error.message };
  revalidatePath("/crm/diario");
  return {};
}

// Metas do Diário: abordagens/dia (crm_goals) e meta/dia de cada etapa com
// regra de follow-up (crm_followup_rules.daily_goal — a mesma da tela
// Configurar follow-ups em Tarefas).
export async function saveDailyGoals(
  approaches: number,
  stageGoals: { stageId: string; goal: number | null }[],
  weeklyLeads?: number
): Promise<Result> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só administradores podem alterar as metas." };
  if (!Number.isInteger(approaches) || approaches < 0) return { error: "Meta de abordagens inválida." };
  if (weeklyLeads !== undefined && (!Number.isInteger(weeklyLeads) || weeklyLeads < 0)) {
    return { error: "Meta semanal de leads inválida." };
  }
  if (stageGoals.some((g) => g.goal !== null && (!Number.isInteger(g.goal) || g.goal < 0))) {
    return { error: "Meta de follow-up inválida." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("crm_goals")
    .select("id")
    .eq("metric", "daily_approaches")
    .is("owner_id", null)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("crm_goals").update({ target: approaches, updated_at: new Date().toISOString() }).eq("id", existing.id)
    : await supabase.from("crm_goals").insert({ metric: "daily_approaches", target: approaches });
  if (error) return { error: error.message };

  if (weeklyLeads !== undefined) {
    const { data: weekly } = await supabase
      .from("crm_goals")
      .select("id")
      .eq("metric", "weekly_new_leads")
      .is("owner_id", null)
      .maybeSingle();
    const { error: weeklyError } = weekly
      ? await supabase.from("crm_goals").update({ target: weeklyLeads, updated_at: new Date().toISOString() }).eq("id", weekly.id)
      : await supabase.from("crm_goals").insert({ metric: "weekly_new_leads", target: weeklyLeads });
    if (weeklyError) return { error: weeklyError.message };
  }

  for (const g of stageGoals) {
    const { error: ruleError } = await supabase
      .from("crm_followup_rules")
      .update({ daily_goal: g.goal })
      .eq("stage_id", g.stageId);
    if (ruleError) return { error: ruleError.message };
  }
  revalidatePath("/crm/diario");
  revalidatePath("/crm/tarefas");
  return {};
}

// Abre o mesmo card do Funil dentro do Diário: carrega só a oportunidade
// clicada (e as etapas do pipeline dela) sob demanda, sem pesar a página.
export async function getOpportunityForModal(
  opportunityId: string
): Promise<{ error?: string; opportunity?: FunilOpportunityRow; stages?: CrmStage[] }> {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("crm_opportunities")
    .select(
      "id, company_id, contact_id, stage_id, status, estimated_value, service_interest, acquisition_channel, event_name, close_probability, search_reason, main_problem, desired_objective, available_budget, decision_maker, start_deadline, referred_by, referral_related_client, referral_type, referral_date, referral_result, ad_platform, campaign, ad_set, ad, keyword, landing_page, form_name, responsible_id, temperature, expected_close_date, entered_at, created_at, crm_stages(pipeline_id), crm_companies(name, website, segment, city, employee_count, approx_revenue, instagram, cnpj, postal_code, google_business_url, other_social_url, bio_link, internal_notes), crm_contacts(name, role_title, phone, whatsapp, email, contact_preference)"
    )
    .eq("id", opportunityId)
    .single();
  if (!o) return { error: "Oportunidade não encontrada." };

  const one = <T,>(rel: T | T[] | null | undefined): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null));
  const company = one(o.crm_companies);
  const contact = one(o.crm_contacts);
  const pipelineId = one(o.crm_stages)?.pipeline_id;

  const [{ data: stages }, { data: lastMove }] = await Promise.all([
    supabase
      .from("crm_stages")
      .select("id, name, position, color, pipeline_id, kind, role")
      .eq("pipeline_id", pipelineId ?? "")
      .order("position"),
    supabase
      .from("crm_stage_history")
      .select("changed_at")
      .eq("opportunity_id", opportunityId)
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    stages: (stages as CrmStage[] | null) ?? [],
    opportunity: {
      id: o.id,
      companyId: o.company_id,
      contactId: o.contact_id,
      stageId: o.stage_id,
      status: o.status,
      estimatedValue: o.estimated_value,
      serviceInterest: o.service_interest,
      acquisitionChannel: o.acquisition_channel,
      eventName: o.event_name,
      details: readDetails(o as unknown as Record<string, unknown>),
      companyExtra: readCompanyExtra(company as unknown as Record<string, unknown> | null),
      responsibleId: o.responsible_id,
      responsibleName: null,
      responsiblePhoto: null,
      temperature: o.temperature,
      expectedCloseDate: o.expected_close_date,
      companyName: company?.name ?? "—",
      contactName: contact?.name ?? null,
      stageEnteredAt: lastMove?.changed_at ?? o.created_at,
      website: company?.website ?? null,
      segment: company?.segment ?? null,
      city: company?.city ?? null,
      employeeCount: company?.employee_count ?? null,
      approxRevenue: company?.approx_revenue ?? null,
      instagram: company?.instagram ?? null,
      contactRole: contact?.role_title ?? null,
      contactPhone: contact?.phone ?? null,
      contactWhatsapp: contact?.whatsapp ?? null,
      contactEmail: contact?.email ?? null,
      contactPreference: contact?.contact_preference ?? null,
    },
  };
}

// --- Dias sem prospecção ---

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Marca dias sem prospecção (hoje ou futuros). No dia: sem abordagens nem
// meta; os follow-ups/tarefas do dia (menos reuniões) são reagendados pro
// próximo dia útil sem marcação, no máximo 10 follow-ups por dia.
export async function setOffDays(
  personId: string,
  dates: string[],
  reason: string | null
): Promise<Result & { moved?: number }> {
  const today = brtToday().date;
  const wanted = Array.from(new Set(dates)).filter((d) => DATE_RE.test(d) && d >= today);
  if (wanted.length === 0) return { error: "Escolha ao menos um dia (hoje ou futuro)." };
  if (wanted.length > 31) return { error: "No máximo 31 dias por vez." };

  const supabase = await createClient();
  const { error } = await supabase.from("crm_off_days").upsert(
    wanted.map((d) => ({ off_date: d, responsible_id: personId, reason: reason?.trim() || null })),
    { onConflict: "off_date,responsible_id" }
  );
  if (error) return { error: error.message };

  const { data: allOff } = await supabase
    .from("crm_off_days")
    .select("off_date")
    .eq("responsible_id", personId)
    .gte("off_date", today);
  const offDates = new Set((allOff ?? []).map((o) => o.off_date as string));

  // Tarefas pendentes do dia (da pessoa ou sem responsável, que também
  // aparecem no Diário dela) dentro dos dias marcados.
  const first = wanted.slice().sort()[0];
  const last = wanted.slice().sort().at(-1)!;
  const windowStart = new Date(`${first}T00:00:00Z`).getTime() + 3 * 3600000;
  const windowEnd = new Date(`${addDays(last, 1)}T00:00:00Z`).getTime() + 3 * 3600000;
  const { data: pending } = await supabase
    .from("crm_tasks")
    .select("id, due_at, source, type")
    .eq("status", "pendente")
    .or(`responsible_id.eq.${personId},responsible_id.is.null`)
    .gte("due_at", new Date(windowStart).toISOString())
    .lt("due_at", new Date(windowEnd).toISOString())
    .limit(500);
  const wantedSet = new Set(wanted);
  const toMove = (pending ?? []).filter(
    (t) => wantedSet.has(brtDateOf(t.due_at)) && !MEETING_TYPES.includes(t.type)
  );

  let moved = 0;
  if (toMove.length > 0) {
    // Carga atual de follow-ups por dia (próximos 60 dias), sem os que vão mover.
    const moveIds = new Set(toMove.map((t) => t.id));
    const { data: future } = await supabase
      .from("crm_tasks")
      .select("id, due_at")
      .eq("status", "pendente")
      .eq("source", "followup")
      .or(`responsible_id.eq.${personId},responsible_id.is.null`)
      .gte("due_at", new Date(windowStart).toISOString())
      .lt("due_at", new Date(windowStart + 60 * 86400000).toISOString())
      .limit(1000);
    const load = new Map<string, number>();
    for (const t of future ?? []) {
      if (moveIds.has(t.id)) continue;
      const d = brtDateOf(t.due_at);
      load.set(d, (load.get(d) ?? 0) + 1);
    }

    const plan = planOffDayReschedule({ tasks: toMove, offDates, load });
    for (const item of plan) {
      const { error: upError } = await supabase.from("crm_tasks").update({ due_at: item.newDueIso }).eq("id", item.id);
      if (!upError) moved++;
    }
  }

  revalidatePath("/crm/diario");
  revalidatePath("/crm/tarefas");
  revalidatePath("/crm/agenda");
  return { moved };
}

// Desfaz a marcação. As tarefas que já foram reagendadas continuam nas
// novas datas.
export async function clearOffDay(personId: string, date: string): Promise<Result> {
  if (!DATE_RE.test(date)) return { error: "Data inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_off_days").delete().eq("responsible_id", personId).eq("off_date", date);
  if (error) return { error: error.message };
  revalidatePath("/crm/diario");
  return {};
}

// "Concluído" no bloco Completar leads: o usuário já pesquisou e não há mais o
// que preencher — o lead sai da lista de incompletos.
export async function markLeadChecked(opportunityId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_opportunities")
    .update({ enrichment_checked_at: new Date().toISOString() })
    .eq("id", opportunityId);
  if (error) return { error: error.message };
  revalidatePath("/crm/diario");
  return {};
}

// --- Abordagem com resultado e próxima aproximação ---

export type ApproachInput = {
  opportunityId: string;
  personId: string;
  // Só em "novas abordagens" (lead): onde o card vai parar depois da abordagem.
  result?: "sem_resposta" | "respondeu" | "sem_interesse" | "outra";
  stageId?: string;
  // Sem canal = só definir a próxima aproximação (nada foi feito agora).
  channel?: ApproachChannel;
  note?: string;
  next?: { date: string; text: string };
};

// Registra a abordagem: (1) move o card conforme o resultado, (2) grava a
// observação na linha do tempo, (3) agenda a próxima aproximação como um
// follow-up manual da oportunidade (aparece no Diário no dia).
export async function registerApproach(input: ApproachInput): Promise<Result> {
  const supabase = await createClient();
  const note = input.note?.trim() ?? "";
  if (note.length > 900) return { error: "Observação: máximo de 900 caracteres." };
  if (input.next && !DATE_RE.test(input.next.date)) return { error: "Data da próxima aproximação inválida." };

  const { data: opp } = await supabase
    .from("crm_opportunities")
    .select("id, responsible_id, stage_id, crm_stages(pipeline_id)")
    .eq("id", input.opportunityId)
    .single();
  if (!opp) return { error: "Oportunidade não encontrada." };
  const pipelineId = (Array.isArray(opp.crm_stages) ? opp.crm_stages[0] : opp.crm_stages)?.pipeline_id as string | undefined;

  // Lead sem responsável passa a ser de quem abordou.
  if (!opp.responsible_id) {
    await supabase.from("crm_opportunities").update({ responsible_id: input.personId }).eq("id", opp.id);
  }

  // 1) etapa de destino conforme o resultado
  if (input.result) {
    if (input.result === "sem_resposta") {
      const moved = await registerContactAttempt(opp.id);
      if (moved.error) return moved;
    } else {
      let targetId: string | null = null;
      if (input.result === "outra") targetId = input.stageId ?? null;
      else if (pipelineId) {
        const role = input.result === "respondeu" ? "contato" : "standby";
        targetId = (await findPipelineStage(supabase, pipelineId, { role }))?.id ?? null;
      }
      if (!targetId) return { error: input.result === "outra" ? "Escolha a etapa." : "Etapa de destino não encontrada no funil." };
      if (targetId !== opp.stage_id) {
        const moved = await moveOpportunityStage(opp.id, targetId);
        if (moved?.error) return moved;
      }
    }
  }

  // 2) observação na linha do tempo
  if (input.channel) {
    const channel = APPROACH_CHANNELS[input.channel];
    if (!channel) return { error: "Canal inválido." };
    await addManualActivity(opp.id, channel.type, note ? `${channel.label}: ${note}` : `${channel.label} — abordagem registrada.`);
  } else if (note) {
    await addManualActivity(opp.id, "anotacao", note);
  }

  // 3) próxima aproximação = follow-up manual futuro
  if (input.next) {
    const text = input.next.text.trim();
    const { error } = await supabase.from("crm_tasks").insert({
      opportunity_id: opp.id,
      type: "follow_up",
      due_at: `${input.next.date}T12:00:00.000Z`,
      responsible_id: opp.responsible_id ?? input.personId,
      description: text || "Próxima aproximação",
      source: "manual",
    });
    if (error) return { error: error.message };
    if (!input.channel || !note) {
      await addManualActivity(opp.id, "anotacao", `Próxima aproximação (${input.next.date.split("-").reverse().join("/")}): ${text || "follow-up"}`);
    }
  }

  revalidatePath("/crm/diario");
  revalidatePath("/crm/funil");
  revalidatePath("/crm/tarefas");
  revalidatePath("/crm/contatos");
  return {};
}
