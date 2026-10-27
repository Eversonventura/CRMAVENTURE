import type { SupabaseClient } from "@supabase/supabase-js";
import type { StageKind, StageRole } from "./types";

// Busca de etapas por kind/role em vez de por nome — o usuário pode
// renomear etapas, as regras do CRM não podem quebrar por isso. Sempre
// dentro de UM pipeline (com mais de um pipeline, "a etapa Perdido" só faz
// sentido no pipeline da oportunidade).

export type LookupStage = {
  id: string;
  name: string;
  position: number;
  kind: StageKind;
  role: StageRole | null;
};

export async function findPipelineStage(
  supabase: SupabaseClient,
  pipelineId: string,
  match: { kind?: StageKind; role?: StageRole }
): Promise<LookupStage | null> {
  let query = supabase
    .from("crm_stages")
    .select("id, name, position, kind, role")
    .eq("pipeline_id", pipelineId);
  if (match.kind) query = query.eq("kind", match.kind);
  if (match.role) query = query.eq("role", match.role);
  const { data } = await query.order("position").limit(1).maybeSingle();
  return (data as LookupStage | null) ?? null;
}

// Pipeline "padrão" (o primeiro por posição) — usado quando não há
// oportunidade de referência, ex.: importação de contatos.
export async function getDefaultPipelineId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("crm_pipelines")
    .select("id")
    .order("position")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
