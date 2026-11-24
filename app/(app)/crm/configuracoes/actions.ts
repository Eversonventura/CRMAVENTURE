"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { SEGMENTS, type BusinessModel } from "../business";

export async function saveBusinessProfile(model: BusinessModel, segment: string | null): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access.isFullAdmin || !access.workspaceId) return { error: "Só o administrador da conta altera as configurações." };
  if (model !== "b2b" && model !== "b2c") return { error: "Modelo comercial inválido." };
  if (segment !== null && !SEGMENTS.some((s) => s.value === segment)) return { error: "Segmento inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_settings")
    .upsert(
      { workspace_id: access.workspaceId, business_model: model, segment, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id" }
    );
  if (error) return { error: error.message };

  // Confere se gravou de verdade (a RLS pode barrar sem erro): lê de volta.
  const { data: saved } = await supabase
    .from("crm_settings")
    .select("business_model, segment")
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();
  if (!saved || saved.business_model !== model || (saved.segment ?? null) !== segment) {
    return { error: `Não foi possível confirmar a gravação na conta "${access.workspaceName ?? access.workspaceId}". Atualize a página e tente de novo; se persistir, avise o suporte.` };
  }
  revalidatePath("/crm", "layout");
  return {};
}

export type CadenceInput = {
  approaches: number; // novas abordagens por dia
  weeklyApproaches: number; // abordagens por semana
  weeklyLeads: number; // leads novos por semana (abastecer o fluxo)
  weeklyAdLeads: number; // leads de anúncio por semana (meta de captação)
  dailyAdReplies: number; // responder leads de anúncio por dia
};

// Cadência do Diário (só administrador): cada meta é um registro em crm_goals (owner nulo).
export async function saveCadence(input: CadenceInput): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só o administrador da conta altera a cadência." };
  const values: [string, number][] = [
    ["daily_approaches", input.approaches],
    ["weekly_approaches", input.weeklyApproaches],
    ["weekly_new_leads", input.weeklyLeads],
    ["weekly_ad_leads", input.weeklyAdLeads],
    ["daily_ad_replies", input.dailyAdReplies],
  ];
  if (values.some(([, v]) => !Number.isInteger(v) || v < 0)) return { error: "Use números inteiros (0 ou mais)." };

  const supabase = await createClient();
  for (const [metric, target] of values) {
    const { data: existing } = await supabase.from("crm_goals").select("id").eq("metric", metric).is("owner_id", null).maybeSingle();
    const { error } = existing
      ? await supabase.from("crm_goals").update({ target, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("crm_goals").insert({ metric, target, direction: "higher" });
    if (error) return { error: error.message };
  }
  revalidatePath("/crm/diario");
  return {};
}
