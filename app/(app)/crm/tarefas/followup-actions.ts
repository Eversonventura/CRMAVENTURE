"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { computeNextDue } from "../followup-plan";
import { TASK_TYPE_LABELS } from "../types";

type Result = { error?: string };

async function denied(): Promise<string | null> {
  const access = await getAccessContext();
  return access.isFullAdmin ? null : "Só administradores podem configurar os follow-ups.";
}

export async function saveFollowupRule(
  stageId: string,
  rule: { taskType: string; intervalDays: number; repeat: boolean; dailyGoal: number | null; active: boolean }
): Promise<Result> {
  const noAccess = await denied();
  if (noAccess) return { error: noAccess };
  if (!(rule.taskType in TASK_TYPE_LABELS)) return { error: "Tipo de tarefa inválido." };
  if (!Number.isInteger(rule.intervalDays) || rule.intervalDays < 0 || rule.intervalDays > 365) {
    return { error: "Intervalo: de 0 a 365 dias." };
  }
  if (rule.dailyGoal !== null && (!Number.isInteger(rule.dailyGoal) || rule.dailyGoal < 0)) {
    return { error: "Meta diária inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("crm_followup_rules").upsert(
    {
      stage_id: stageId,
      task_type: rule.taskType,
      interval_days: rule.intervalDays,
      repeat: rule.repeat,
      daily_goal: rule.dailyGoal,
      active: rule.active,
    },
    { onConflict: "stage_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/crm/tarefas");
  return {};
}

export async function deleteFollowupRule(stageId: string): Promise<Result> {
  const noAccess = await denied();
  if (noAccess) return { error: noAccess };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_followup_rules").delete().eq("stage_id", stageId);
  if (error) return { error: error.message };
  revalidatePath("/crm/tarefas");
  return {};
}

// Regras só valem pros cards que MUDAREM de etapa daqui pra frente. Este
// botão aplica a regra aos que já estão na etapa e estão sem nenhuma tarefa
// pendente (não duplica nada com o que já existe).
export async function applyRuleToExistingCards(stageId: string): Promise<Result & { created?: number }> {
  const noAccess = await denied();
  if (noAccess) return { error: noAccess };
  const supabase = await createClient();

  const { data: rule } = await supabase
    .from("crm_followup_rules")
    .select("task_type, interval_days, active")
    .eq("stage_id", stageId)
    .maybeSingle();
  if (!rule || !rule.active) return { error: "Essa etapa não tem regra ativa." };

  const [{ data: opps }, { data: pending }, { data: stage }] = await Promise.all([
    supabase.from("crm_opportunities").select("id, responsible_id").eq("stage_id", stageId).eq("status", "aberta"),
    supabase.from("crm_tasks").select("opportunity_id").eq("status", "pendente"),
    supabase.from("crm_stages").select("name").eq("id", stageId).single(),
  ]);
  const withTask = new Set((pending ?? []).map((t) => t.opportunity_id));
  const targets = (opps ?? []).filter((o) => !withTask.has(o.id));
  if (targets.length === 0) return { created: 0 };

  const dueAt = computeNextDue(new Date(), rule.interval_days).toISOString();
  const { error } = await supabase.from("crm_tasks").insert(
    targets.map((o) => ({
      opportunity_id: o.id,
      type: rule.task_type,
      due_at: dueAt,
      responsible_id: o.responsible_id,
      source: "followup",
      stage_id: stageId,
      description: `Follow-up automático da etapa "${stage?.name ?? ""}".`,
    }))
  );
  if (error) return { error: error.message };
  revalidatePath("/crm/tarefas");
  return { created: targets.length };
}
