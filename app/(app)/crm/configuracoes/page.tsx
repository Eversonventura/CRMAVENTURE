import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { NoPermission } from "@/components/NoPermission";
import { OLYMPIC_KEYS, readOlympicSettings } from "../olympic";
import { getCrmSettings } from "../settings";
import type { FollowupRule } from "../followup-plan";
import { ConfigManager } from "./ConfigManager";

const DEFAULT_APPROACH_GOAL = 10;

export default async function ConfiguracoesPage() {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return <NoPermission />;

  const supabase = await createClient();
  const [settings, { data: goalRows }, { data: ruleRows }, { data: stageRows }, { data: pipelineRows }] = await Promise.all([
    getCrmSettings(),
    supabase
      .from("crm_goals")
      .select("metric, target")
      .is("owner_id", null)
      .in("metric", ["daily_approaches", "weekly_new_leads", ...OLYMPIC_KEYS]),
    supabase.from("crm_followup_rules").select("id, stage_id, task_type, interval_days, repeat, daily_goal, active"),
    supabase.from("crm_stages").select("id, name, pipeline_id, kind, position").order("position"),
    supabase.from("crm_pipelines").select("id, name").order("position"),
  ]);

  const goals: Record<string, number> = {};
  for (const g of (goalRows as { metric: string; target: number }[] | null) ?? []) goals[g.metric] = Number(g.target);
  const approaches = goals.daily_approaches ?? DEFAULT_APPROACH_GOAL;

  return (
    <ConfigManager
      model={settings.businessModel}
      segment={settings.segment}
      approaches={approaches}
      weekly={goals.weekly_new_leads ?? approaches * 5}
      olympic={readOlympicSettings(goals)}
      followups={{
        rules: (ruleRows as FollowupRule[] | null) ?? [],
        stages: (stageRows as { id: string; name: string; pipeline_id: string; kind: string; position: number }[] | null) ?? [],
        pipelines: (pipelineRows as { id: string; name: string }[] | null) ?? [],
      }}
    />
  );
}
