import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendCrmEmail } from "@/app/(app)/crm/email";

// Automações diárias do CRM (Vercel Cron — ver vercel.json). Roda com a
// service_role (sem sessão), então cada linha carrega o próprio workspace_id.
//   1) Cadências: passos vencidos viram tarefas; cadência concluída sem
//      resposta manda a oportunidade para nutrição.
//   2) E-mails (se RESEND_API_KEY existir): lembrete de reunião em <24h,
//      oportunidade parada há 5+ dias e tarefa vencida (1x por dia cada).

export const dynamic = "force-dynamic";

const STEP_COUNT: Record<string, number> = {
  resgate_conversa: 5,
  resgate_reuniao: 4,
  follow_up_proposta: 5,
};

type One<T> = T | T[] | null;
const one = <T,>(rel: One<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel);

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const result = { tasksCreated: 0, movedToNurturing: 0, reminders: 0, staleAlerts: 0, overdueAlerts: 0 };

  // E-mail do responsável (team_members.email).
  const emailCache = new Map<string, string[]>();
  async function emailsFor(memberId: string | null): Promise<string[]> {
    if (!memberId) return [];
    const cached = emailCache.get(memberId);
    if (cached) return cached;
    const { data } = await supabase.from("team_members").select("email").eq("id", memberId).maybeSingle();
    const list = data?.email ? [data.email as string] : [];
    emailCache.set(memberId, list);
    return list;
  }

  // 1) Cadências ------------------------------------------------------------
  const { data: dueSteps } = await supabase
    .from("crm_cadence_steps")
    .select("id, workspace_id, opportunity_id, cadence_type, step_number, crm_opportunities(responsible_id)")
    .eq("completed", false)
    .lte("scheduled_for", today);

  for (const step of dueSteps ?? []) {
    try {
      const opp = one(step.crm_opportunities as One<{ responsible_id: string | null }>);
      await supabase.from("crm_tasks").insert({
        workspace_id: step.workspace_id,
        opportunity_id: step.opportunity_id,
        type: "follow_up",
        due_at: now.toISOString(),
        responsible_id: opp?.responsible_id ?? null,
        description: `Cadência ${step.cadence_type} — passo ${step.step_number}`,
        source: "cadence",
      });
      result.tasksCreated++;
      await supabase.from("crm_cadence_steps").update({ completed: true }).eq("id", step.id);

      if (step.step_number >= (STEP_COUNT[step.cadence_type] ?? step.step_number)) {
        await supabase
          .from("crm_opportunities")
          .update({ in_nurturing: true, rescue_status: null })
          .eq("id", step.opportunity_id);
        result.movedToNurturing++;
      }
    } catch {
      // um passo com problema não derruba os demais
    }
  }

  // 2) E-mails ----------------------------------------------------------------
  if (process.env.RESEND_API_KEY) {
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    const { data: upcoming } = await supabase
      .from("crm_tasks")
      .select("id, due_at, responsible_id, crm_opportunities(crm_companies(name))")
      .in("type", ["agendar_reuniao", "realizar_reuniao"])
      .eq("status", "pendente")
      .is("reminder_sent_at", null)
      .lte("due_at", in24h)
      .gte("due_at", now.toISOString());

    for (const t of upcoming ?? []) {
      const opp = one(t.crm_opportunities as One<{ crm_companies: One<{ name: string }> }>);
      const company = one(opp?.crm_companies ?? null);
      await sendCrmEmail(
        await emailsFor(t.responsible_id as string | null),
        `Lembrete: reunião com ${company?.name ?? "cliente"} em menos de 24h`,
        `Reunião marcada para ${new Date(t.due_at as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
      );
      await supabase.from("crm_tasks").update({ reminder_sent_at: now.toISOString() }).eq("id", t.id);
      result.reminders++;
    }

    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString();
    const { data: openOpps } = await supabase
      .from("crm_opportunities")
      .select("id, responsible_id, crm_companies(name)")
      .eq("status", "aberta")
      .or(`stale_alert_sent_at.is.null,stale_alert_sent_at.lt.${today}`);

    for (const o of openOpps ?? []) {
      const { data: last } = await supabase
        .from("crm_activities")
        .select("occurred_at")
        .eq("opportunity_id", o.id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.occurred_at && last.occurred_at > fiveDaysAgo) continue;

      const company = one(o.crm_companies as One<{ name: string }>);
      await sendCrmEmail(
        await emailsFor(o.responsible_id as string | null),
        `Oportunidade parada: ${company?.name ?? "cliente"}`,
        "Sem nenhuma atividade registrada há mais de 5 dias."
      );
      await supabase.from("crm_opportunities").update({ stale_alert_sent_at: today }).eq("id", o.id);
      result.staleAlerts++;
    }

    const { data: overdue } = await supabase
      .from("crm_tasks")
      .select("id, type, due_at, responsible_id, crm_opportunities(crm_companies(name))")
      .eq("status", "pendente")
      .lt("due_at", now.toISOString())
      .or(`overdue_alert_sent_at.is.null,overdue_alert_sent_at.lt.${today}`);

    for (const t of overdue ?? []) {
      const opp = one(t.crm_opportunities as One<{ crm_companies: One<{ name: string }> }>);
      const company = one(opp?.crm_companies ?? null);
      await sendCrmEmail(
        await emailsFor(t.responsible_id as string | null),
        `Tarefa vencida — ${company?.name ?? "cliente"}`,
        `Tarefa "${t.type}" venceu em ${new Date(t.due_at as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} e ainda está pendente.`
      );
      await supabase.from("crm_tasks").update({ overdue_alert_sent_at: today }).eq("id", t.id);
      result.overdueAlerts++;
    }
  }

  return NextResponse.json(result);
}
