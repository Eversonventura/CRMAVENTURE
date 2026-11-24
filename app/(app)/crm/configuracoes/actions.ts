"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { SEGMENTS, type BusinessModel } from "../business";
import { DEFAULT_CHANNELS } from "../channels";

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
  if (!access.isManager) return { error: "Só administrador e gestor alteram a cadência." };
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

// ---------------------------------------------------------------------------
// Origens (canais de aquisição) da conta — só administrador. Conta sem origens cadastradas usa a lista
// padrão; no primeiro ajuste a lista padrão é gravada na conta e a mudança vale em cima dela.
// Leads antigos mantêm a origem que já têm (o texto fica gravado no lead).
// ---------------------------------------------------------------------------
type ChannelResult = { error?: string };

async function ensureChannels(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string): Promise<string | null> {
  const { count, error } = await supabase
    .from("crm_acquisition_channels")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) return error.message;
  if ((count ?? 0) > 0) return null;
  const { error: seedError } = await supabase.from("crm_acquisition_channels").insert(
    DEFAULT_CHANNELS.map((c, i) => ({ workspace_id: workspaceId, name: c.name, is_ad: c.isAd, position: i }))
  );
  return seedError?.message ?? null;
}

async function channelContext() {
  const access = await getAccessContext();
  if (!access.isFullAdmin || !access.workspaceId) return { error: "Só o administrador da conta altera as origens." } as const;
  return { workspaceId: access.workspaceId, supabase: await createClient() } as const;
}

export async function addChannel(name: string, isAd: boolean): Promise<ChannelResult> {
  const ctx = await channelContext();
  if ("error" in ctx) return { error: ctx.error };
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 1 || clean.length > 60) return { error: "Informe um nome de até 60 caracteres." };
  const seeded = await ensureChannels(ctx.supabase, ctx.workspaceId);
  if (seeded) return { error: seeded };
  const { data: last } = await ctx.supabase
    .from("crm_acquisition_channels")
    .select("position")
    .eq("workspace_id", ctx.workspaceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await ctx.supabase
    .from("crm_acquisition_channels")
    .insert({ workspace_id: ctx.workspaceId, name: clean, is_ad: isAd, position: (last?.position ?? -1) + 1 });
  if (error) return { error: error.code === "23505" ? "Essa origem já existe." : error.message };
  revalidatePath("/crm", "layout");
  return {};
}

export async function removeChannel(name: string): Promise<ChannelResult> {
  const ctx = await channelContext();
  if ("error" in ctx) return { error: ctx.error };
  const seeded = await ensureChannels(ctx.supabase, ctx.workspaceId);
  if (seeded) return { error: seeded };
  const { count } = await ctx.supabase
    .from("crm_acquisition_channels")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspaceId);
  if ((count ?? 0) <= 1) return { error: "Mantenha ao menos uma origem." };
  const { error } = await ctx.supabase.from("crm_acquisition_channels").delete().eq("workspace_id", ctx.workspaceId).eq("name", name);
  if (error) return { error: error.message };
  revalidatePath("/crm", "layout");
  return {};
}

export async function setChannelAd(name: string, isAd: boolean): Promise<ChannelResult> {
  const ctx = await channelContext();
  if ("error" in ctx) return { error: ctx.error };
  const seeded = await ensureChannels(ctx.supabase, ctx.workspaceId);
  if (seeded) return { error: seeded };
  const { error } = await ctx.supabase.from("crm_acquisition_channels").update({ is_ad: isAd }).eq("workspace_id", ctx.workspaceId).eq("name", name);
  if (error) return { error: error.message };
  revalidatePath("/crm", "layout");
  return {};
}
