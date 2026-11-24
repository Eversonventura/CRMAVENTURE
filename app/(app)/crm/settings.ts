import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
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

  if (!data) return { ...DEFAULT_SETTINGS, salesMode };
  return { businessModel: (data.business_model as BusinessModel) ?? "b2b", segment: (data.segment as string | null) ?? null, salesMode };
});
