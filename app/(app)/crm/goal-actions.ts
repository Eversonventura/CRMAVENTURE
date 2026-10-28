"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { GOAL_METRICS } from "./goals";
import { OLYMPIC_KEYS } from "./olympic";
import { SALES_METRICS } from "./sales-goals";

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

// Metas de vendas por vendedor (fechamentos e receita, mensais). Campo vazio
// (null) remove a meta pessoal daquela pessoa.
export type MemberSalesGoal = { memberId: string; fechamentos: number | null; receita_fechada: number | null };

export async function saveMemberSalesGoals(rows: MemberSalesGoal[]): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só administradores podem alterar as metas." };

  const supabase = await createClient();
  // Só pessoas da conta ativa (a RLS não confere o owner_id).
  const { data: people } = await supabase.rpc("team_member_picker_options");
  const valid = new Set(((people as { id: string }[] | null) ?? []).map((p) => p.id));

  for (const row of rows) {
    if (!valid.has(row.memberId)) return { error: "Pessoa não encontrada nesta conta." };
    for (const metric of SALES_METRICS) {
      const value = row[metric];
      if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: "Meta inválida." };

      const { data: existing } = await supabase
        .from("crm_goals")
        .select("id")
        .eq("metric", metric)
        .eq("owner_id", row.memberId)
        .maybeSingle();

      let error: { message: string } | null = null;
      if (value === null) {
        if (existing) ({ error } = await supabase.from("crm_goals").delete().eq("id", existing.id));
      } else if (existing) {
        ({ error } = await supabase.from("crm_goals").update({ target: value, updated_at: new Date().toISOString() }).eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("crm_goals").insert({ metric, owner_id: row.memberId, target: value, direction: "higher" }));
      }
      if (error) return { error: error.message };
    }
  }
  revalidatePath("/crm/visao-geral");
  revalidatePath("/crm/diario");
  return {};
}
