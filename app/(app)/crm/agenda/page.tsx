import { createClient } from "@/lib/supabase/server";
import { AgendaView } from "./AgendaView";

export default async function CrmAgendaPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("crm_tasks")
    .select(
      "id, type, due_at, status, crm_opportunities(crm_companies(name))"
    )
    .neq("status", "cancelada")
    .gte("due_at", new Date(Date.now() - 60 * 86400000).toISOString())
    .lt("due_at", new Date(Date.now() + 180 * 86400000).toISOString())
    .order("due_at")
    .limit(1500);

  type RawTask = {
    id: string;
    type: string;
    due_at: string;
    status: string;
    crm_opportunities: { crm_companies: { name: string } | { name: string }[] | null } | { crm_companies: { name: string } | { name: string }[] | null }[] | null;
  };

  const rows = ((tasks as unknown as RawTask[]) ?? []).map((t) => {
    const opp = Array.isArray(t.crm_opportunities) ? t.crm_opportunities[0] : t.crm_opportunities;
    const company = Array.isArray(opp?.crm_companies) ? opp?.crm_companies[0] : opp?.crm_companies;
    return {
      id: t.id,
      type: t.type,
      dueAt: t.due_at,
      status: t.status,
      companyName: company?.name ?? "—",
    };
  });

  return <AgendaView allTasks={rows} />;
}
