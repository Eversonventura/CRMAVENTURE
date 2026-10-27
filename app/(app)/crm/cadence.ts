import { createClient } from "@/lib/supabase/server";

export type CadenceType = "resgate_conversa" | "resgate_reuniao" | "follow_up_proposta";

// Offsets em dias a partir do início da cadência (dia 0 = hoje, ou a
// data de referência — presented_at no caso de follow-up de proposta).
const CADENCE_OFFSETS: Record<CadenceType, number[]> = {
  resgate_conversa: [0, 2, 5, 10, 20],
  resgate_reuniao: [0, 1, 3, 7],
  follow_up_proposta: [1, 3, 7, 14, 21],
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Cria os passos da cadência (crm_cadence_steps) a partir de uma data
// base, e marca a oportunidade como "em resgate". A Edge Function diária
// (process-crm-cadences) materializa cada passo numa crm_tasks quando
// chega a data.
export async function startCadence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opportunityId: string,
  cadenceType: CadenceType,
  baseDate: Date = new Date()
) {
  const offsets = CADENCE_OFFSETS[cadenceType];
  const steps = offsets.map((offset, i) => ({
    opportunity_id: opportunityId,
    cadence_type: cadenceType,
    step_number: i + 1,
    scheduled_for: addDays(baseDate, offset),
  }));

  await supabase.from("crm_cadence_steps").insert(steps);

  if (cadenceType !== "follow_up_proposta") {
    await supabase
      .from("crm_opportunities")
      .update({ rescue_status: "em_resgate" })
      .eq("id", opportunityId);
  }
}

// Cancela os passos restantes de qualquer cadência ativa dessa
// oportunidade — chamado quando o lead responde (mensagem/ligação/
// e-mail registrada durante uma cadência em curso).
export async function cancelActiveCadences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opportunityId: string
) {
  const { data: hadActive } = await supabase
    .from("crm_cadence_steps")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq("completed", false)
    .limit(1);

  if (!hadActive || hadActive.length === 0) return;

  await supabase
    .from("crm_cadence_steps")
    .update({ completed: true })
    .eq("opportunity_id", opportunityId)
    .eq("completed", false);

  await supabase
    .from("crm_opportunities")
    .update({ rescue_status: null })
    .eq("id", opportunityId);
}
