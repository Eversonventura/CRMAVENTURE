import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { DEFAULT_CHANNELS, type Channel } from "./channels";
import { DEFAULT_SETTINGS, type BusinessModel, type CrmSettings, type SalesMode } from "./business";

// Configurações da conta ativa (modelo comercial e segmento). Qualquer membro lê;
// só o administrador altera (RLS).
export const getCrmSettings = cache(async (): Promise<CrmSettings> => {
  const access = await getAccessContext();
  if (!access.workspaceId) return DEFAULT_SETTINGS;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_settings")
    .select("business_model, segment")
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();
  if (error) console.error("crm_settings: leitura falhou:", error.message);

  // Modo de medir vendas (meta olímpica por contratos = 1): o sistema inteiro acompanha.
  const { data: modeRow } = await supabase
    .from("crm_goals")
    .select("target")
    .eq("metric", "olympic_mode")
    .is("owner_id", null)
    .maybeSingle();
  const salesMode: SalesMode = modeRow && Number(modeRow.target) === 1 ? "contratos" : "valor";

  // Origens da conta (sem linhas = lista padrão).
  const { data: channelRows } = await supabase
    .from("crm_acquisition_channels")
    .select("name, is_ad")
    .eq("workspace_id", access.workspaceId)
    .order("position")
    .order("created_at");
  const channels: Channel[] =
    channelRows && channelRows.length > 0
      ? (channelRows as { name: string; is_ad: boolean }[]).map((c) => ({ name: c.name, isAd: c.is_ad }))
      : DEFAULT_CHANNELS;

  if (!data) return { ...DEFAULT_SETTINGS, salesMode, channels };
  return { businessModel: (data.business_model as BusinessModel) ?? "b2b", segment: (data.segment as string | null) ?? null, salesMode, channels };
});
