import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type BusinessModel, type CrmSettings } from "./business";

// Configurações da conta ativa (modelo comercial e segmento). Qualquer membro lê;
// só o administrador altera (RLS).
export const getCrmSettings = cache(async (): Promise<CrmSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("crm_settings").select("business_model, segment").maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { businessModel: (data.business_model as BusinessModel) ?? "b2b", segment: (data.segment as string | null) ?? null };
});
