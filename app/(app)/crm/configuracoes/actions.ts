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
  revalidatePath("/crm", "layout");
  return {};
}
