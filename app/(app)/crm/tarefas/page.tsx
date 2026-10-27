import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { TasksList } from "./TasksList";
import type { FollowupRule } from "../followup-plan";
import type { CrmTask, TeamMemberOption } from "../types";

export default async function CrmTarefasPage() {
  const supabase = await createClient();
  const canConfigure = (await getAccessContext()).isFullAdmin;

  const [{ data: tasks }, { data: teamMembers }, { data: opportunities }, { data: ruleRows }, { data: stageRows }, { data: pipelineRows }] = await Promise.all([
    supabase
      .from("crm_tasks")
      .select(
        "id, opportunity_id, type, responsible_id, due_at, priority, description, status, activity_result, created_at, source, stage_id, crm_stages(name), crm_opportunities(crm_companies(name))"
      )
      .eq("status", "pendente")
      .order("due_at"),
    supabase.rpc("team_member_picker_options"),
    supabase
      .from("crm_opportunities")
      .select("id, crm_companies(name)")
      .eq("status", "aberta"),
    canConfigure
      ? supabase.from("crm_followup_rules").select("id, stage_id, task_type, interval_days, repeat, daily_goal, active")
      : Promise.resolve({ data: [] }),
    canConfigure
      ? supabase.from("crm_stages").select("id, name, pipeline_id, kind, position").order("position")
      : Promise.resolve({ data: [] }),
    canConfigure ? supabase.from("crm_pipelines").select("id, name").order("position") : Promise.resolve({ data: [] }),
  ]);

  const members = (teamMembers as TeamMemberOption[] | null) ?? [];
  const memberById = new Map(members.map((m) => [m.id, m.full_name]));

  type RawTask = {
    id: string;
    opportunity_id: string;
    type: CrmTask["type"];
    responsible_id: string | null;
    due_at: string;
    priority: string | null;
    description: string | null;
    status: CrmTask["status"];
    activity_result: string | null;
    created_at: string;
    source: CrmTask["source"];
    stage_id: string | null;
    crm_stages: { name: string } | { name: string }[] | null;
    crm_opportunities: { crm_companies: { name: string } | { name: string }[] | null } | { crm_companies: { name: string } | { name: string }[] | null }[] | null;
  };

  function companyNameFrom(rel: RawTask["crm_opportunities"]) {
    const opp = Array.isArray(rel) ? rel[0] : rel;
    const company = Array.isArray(opp?.crm_companies) ? opp?.crm_companies[0] : opp?.crm_companies;
    return company?.name ?? "—";
  }

  const rows: CrmTask[] = ((tasks as unknown as RawTask[]) ?? []).map((t) => ({
    ...t,
    stageName: (Array.isArray(t.crm_stages) ? t.crm_stages[0] : t.crm_stages)?.name ?? null,
    companyName: companyNameFrom(t.crm_opportunities),
    responsibleName: t.responsible_id ? memberById.get(t.responsible_id) ?? null : null,
  }));

  type RawOpp = { id: string; crm_companies: { name: string } | { name: string }[] | null };
  const opportunityOptions = ((opportunities as unknown as RawOpp[]) ?? []).map((o) => ({
    id: o.id,
    companyName: Array.isArray(o.crm_companies) ? o.crm_companies[0]?.name ?? "—" : o.crm_companies?.name ?? "—",
  }));

  return (
    <TasksList
      tasks={rows}
      teamMembers={members}
      opportunities={opportunityOptions}
      config={
        canConfigure
          ? {
              rules: (ruleRows as FollowupRule[] | null) ?? [],
              stages: (stageRows as { id: string; name: string; pipeline_id: string; kind: string; position: number }[] | null) ?? [],
              pipelines: (pipelineRows as { id: string; name: string }[] | null) ?? [],
            }
          : null
      }
    />
  );
}
