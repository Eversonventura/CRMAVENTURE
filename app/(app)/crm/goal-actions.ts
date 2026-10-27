"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { GOAL_METRICS } from "./goals";
import { OLYMPIC_KEYS } from "./olympic";

export async function saveCrmGoals(values: Record<string, number>): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só administradores podem alterar as metas." };

  const supabase = await createClient();
  for (const def of GOAL_METRICS) {
    const value = values[def.key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) return { error: `Meta inválida: ${def.label}.` };

    const { data: existing } = await supabase
      .from("crm_goals")
      .select("id")
      .eq("metric", def.key)
      .is("owner_id", null)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("crm_goals").update({ target: value, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("crm_goals").insert({ metric: def.key, target: value, direction: def.direction });
    if (error) return { error: error.message };
  }
  revalidatePath("/crm/visao-geral");
  return {};
}

// Metas olímpicas / RMV (ponto de partida, inflação, percentuais, multiplicador).
export async function saveOlympicGoals(values: Record<string, number>): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só administradores podem alterar as metas." };

  const supabase = await createClient();
  for (const key of OLYMPIC_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) return { error: `Valor inválido: ${key}.` };
    const { data: existing } = await supabase.from("crm_goals").select("id").eq("metric", key).is("owner_id", null).maybeSingle();
    const { error } = existing
      ? await supabase.from("crm_goals").update({ target: value, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("crm_goals").insert({ metric: key, target: value });
    if (error) return { error: error.message };
  }
  revalidatePath("/crm/visao-geral");
  return {};
}
