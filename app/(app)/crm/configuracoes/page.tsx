import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { NoPermission } from "@/components/NoPermission";
import { OLYMPIC_KEYS, readOlympicSettings } from "../olympic";
import { getCrmSettings } from "../settings";
import type { FollowupRule } from "../followup-plan";
import { GOAL_METRICS } from "../goals";
import type { SalesGoalMap } from "../sales-goals";
import { ConfigManager } from "./ConfigManager";

const DEFAULT_APPROACH_GOAL = 10;

export default async function ConfiguracoesPage() {
  const access = await getAccessContext();
  if (!access.isManager) return <NoPermission />;

  const supabase = await createClient();
  const [settings, { data: goalRows }, { data: ruleRows }, { data: stageRows }, { data: pipelineRows }, { data: allGoalRows }, { data: memberRows }] = await Promise.all([
    getCrmSettings(),
    supabase
      .from("crm_goals")
      .select("metric, target")
      .is("owner_id", null)
      .in("metric", ["daily_approaches", "weekly_approaches", "weekly_new_leads", "weekly_ad_leads", "daily_ad_replies", ...OLYMPIC_KEYS]),
    supabase.from("crm_followup_rules").select("id, stage_id, task_type, interval_days, repeat, daily_goal, active"),
    supabase.from("crm_stages").select("id, name, pipeline_id, kind, position").order("position"),
    supabase.from("crm_pipelines").select("id, name").order("position"),
    supabase.from("crm_goals").select("metric, target, owner_id"),
    supabase.rpc("team_member_picker_options"),
  ]);

  // Metas do mês: da equipe (owner nulo) e de vendas por vendedor.
  const kpiTargets: Record<string, number> = {};
  const memberGoals: SalesGoalMap = {};
  for (const g of (allGoalRows as { metric: string; target: number; owner_id: string | null }[] | null) ?? []) {
    if (g.owner_id === null) {
      if (GOAL_METRICS.some((m) => m.key === g.metric)) kpiTargets[g.metric] = Number(g.target);
    } else if (g.metric === "fechamentos" || g.metric === "receita_fechada") {
      memberGoals[g.owner_id] = { ...memberGoals[g.owner_id], [g.metric]: Number(g.target) };
    }
  }

  const goals: Record<string, number> = {};
  for (const g of (goalRows as { metric: string; target: number }[] | null) ?? []) goals[g.metric] = Number(g.target);
  const approaches = goals.daily_approaches ?? DEFAULT_APPROACH_GOAL;

  return (
    <ConfigManager
      isAdmin={access.isFullAdmin}
      model={settings.businessModel}
      segment={settings.segment}
      approaches={approaches}
      weekly={goals.weekly_new_leads ?? approaches * 5}
      weeklyApproaches={goals.weekly_approaches ?? approaches * 5}
      weeklyAdLeads={goals.weekly_ad_leads ?? 0}
      dailyAdReplies={goals.daily_ad_replies ?? 0}
      olympic={readOlympicSettings(goals)}
      salesMode={settings.salesMode}
      kpiTargets={kpiTargets}
      members={((memberRows as { id: string; full_name: string }[] | null) ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
      memberGoals={memberGoals}
      followups={{
        rules: (ruleRows as FollowupRule[] | null) ?? [],
        stages: (stageRows as { id: string; name: string; pipeline_id: string; kind: string; position: number }[] | null) ?? [],
        pipelines: (pipelineRows as { id: string; name: string }[] | null) ?? [],
      }}
    />
  );
}
