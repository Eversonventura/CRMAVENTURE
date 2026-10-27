import { createClient } from "@/lib/supabase/server";
import { logCrmActivity } from "./activity";
import { planOnComplete, planOnStageChange, type FollowupRule } from "./followup-plan";
import { skipOffDays } from "./diario/off-days";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const RULE_COLUMNS = "id, stage_id, task_type, interval_days, repeat, daily_goal, active";

async function loadRule(supabase: Supabase, stageId: string): Promise<FollowupRule | null> {
  const { data } = await supabase.from("crm_followup_rules").select(RULE_COLUMNS).eq("stage_id", stageId).maybeSingle();
  return (data as FollowupRule | null) ?? null;
}

async function loadPendingFollowups(supabase: Supabase, opportunityId: string) {
  const { data } = await supabase
    .from("crm_tasks")
    .select("id, stage_id")
    .eq("opportunity_id", opportunityId)
    .eq("source", "followup")
    .eq("status", "pendente");
  return (data as { id: string; stage_id: string | null }[] | null) ?? [];
}

async function scheduleTask(
  supabase: Supabase,
  opportunityId: string,
  stageId: string,
  responsibleId: string | null,
  plan: { type: string; dueAt: Date },
  note: string
) {
  // Não agenda em dia que o responsável marcou como "sem prospecção".
  let dueAt = plan.dueAt;
  if (responsibleId) {
    const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const { data: off } = await supabase
      .from("crm_off_days")
      .select("off_date")
      .eq("responsible_id", responsibleId)
      .gte("off_date", today);
    if (off && off.length > 0) dueAt = skipOffDays(dueAt, new Set(off.map((o) => o.off_date as string)));
  }
  await supabase.from("crm_tasks").insert({
    opportunity_id: opportunityId,
    type: plan.type,
    due_at: dueAt.toISOString(),
    responsible_id: responsibleId,
    source: "followup",
    stage_id: stageId,
    description: note,
  });
}

// Chamado por todo caminho que muda a etapa de uma oportunidade (mover no
// funil, editar, criar, marcar perdida, registrar tentativa). Mover o card
// continua manual; o agendamento da tarefa da etapa é que é automático.
export async function syncOpportunityTasks(
  supabase: Supabase,
  opportunityId: string,
  toStageId: string,
  fromStageId?: string | null
) {
  if (fromStageId && fromStageId === toStageId) return;

  const [{ data: opp }, { data: stage }, pending, rule] = await Promise.all([
    supabase.from("crm_opportunities").select("status, responsible_id").eq("id", opportunityId).single(),
    supabase.from("crm_stages").select("name, kind").eq("id", toStageId).single(),
    loadPendingFollowups(supabase, opportunityId),
    loadRule(supabase, toStageId),
  ]);

  const open = opp?.status === "aberta" && stage?.kind === "open";
  const plan = planOnStageChange({ toStageId, rule, pending, opportunityOpen: open, now: new Date() });

  if (plan.cancelIds.length > 0) {
    await supabase.from("crm_tasks").update({ status: "cancelada" }).in("id", plan.cancelIds);
  }
  if (plan.create) {
    await scheduleTask(
      supabase,
      opportunityId,
      toStageId,
      opp?.responsible_id ?? null,
      plan.create,
      `Follow-up automático da etapa "${stage?.name ?? ""}".`
    );
    await logCrmActivity(supabase, opportunityId, "automacao", `Tarefa agendada pela etapa "${stage?.name ?? ""}".`);
  }
}

// Chamado ao concluir uma tarefa gerada por regra, quando o usuário não
// definiu uma próxima ação à mão.
export async function rescheduleAfterComplete(
  supabase: Supabase,
  task: { opportunity_id: string; stage_id: string | null }
) {
  if (!task.stage_id) return;
  const [{ data: opp }, rule, pending] = await Promise.all([
    supabase.from("crm_opportunities").select("status, stage_id, responsible_id").eq("id", task.opportunity_id).single(),
    loadRule(supabase, task.stage_id),
    loadPendingFollowups(supabase, task.opportunity_id),
  ]);
  const plan = planOnComplete({
    taskStageId: task.stage_id,
    currentStageId: opp?.stage_id ?? null,
    rule,
    opportunityOpen: opp?.status === "aberta",
    hasPendingHere: pending.some((t) => t.stage_id === task.stage_id),
    now: new Date(),
  });
  if (plan) {
    await scheduleTask(
      supabase,
      task.opportunity_id,
      task.stage_id,
      opp?.responsible_id ?? null,
      plan,
      "Follow-up automático (próximo ciclo da etapa)."
    );
  }
}
