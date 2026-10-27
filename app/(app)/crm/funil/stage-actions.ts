"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import type { StageKind, StageRole } from "../types";

// Edição da estrutura do funil (etapas e pipelines). A RLS de crm_stages e
// crm_pipelines só deixa full admin escrever — aqui a checagem é pra dar
// uma mensagem clara em vez de um update que "não pega" em silêncio (RLS
// em update devolve 0 linhas, não erro).

const KINDS: StageKind[] = ["open", "won", "lost"];
const ROLES: StageRole[] = [
  "lead",
  "tentativa",
  "contato",
  "briefing",
  "diagnostico_proposta",
  "negociacao",
  "standby",
];
const NEW_STAGE_COLOR = "#64748B";

type Result = { error?: string };

async function requireFullAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Sessão expirada. Entre de novo.";
  const access = await getAccessContext();
  if (!access.isFullAdmin) return "Só administradores podem editar etapas e pipelines.";
  return null;
}

function refresh() {
  revalidatePath("/crm/funil");
  revalidatePath("/crm/visao-geral");
}

type StageRow = { id: string; position: number; kind: StageKind; role: StageRole | null; pipeline_id: string };

async function listPipelineStages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pipelineId: string
): Promise<StageRow[]> {
  const { data } = await supabase
    .from("crm_stages")
    .select("id, position, kind, role, pipeline_id")
    .eq("pipeline_id", pipelineId)
    .order("position");
  return (data as StageRow[] | null) ?? [];
}

async function countOpportunitiesInStages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stageIds: string[]
): Promise<number> {
  if (stageIds.length === 0) return 0;
  const { count } = await supabase
    .from("crm_opportunities")
    .select("id", { count: "exact", head: true })
    .in("stage_id", stageIds);
  return count ?? 0;
}

// Nova etapa entra antes da primeira etapa de ganho/perda — "Fechado" e
// "Perdido" continuam sempre no fim do funil.
export async function createStage(pipelineId: string, name: string): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Dê um nome pra etapa." };

  const supabase = await createClient();
  const stages = await listPipelineStages(supabase, pipelineId);
  const firstClosing = stages.find((s) => s.kind !== "open");
  const insertAt = firstClosing ? firstClosing.position : (stages.at(-1)?.position ?? -1) + 1;

  const shifted = stages.filter((s) => s.position >= insertAt);
  for (const s of shifted) {
    const { error } = await supabase.from("crm_stages").update({ position: s.position + 1 }).eq("id", s.id);
    if (error) return { error: error.message };
  }

  const { error } = await supabase.from("crm_stages").insert({
    pipeline_id: pipelineId,
    name: trimmed,
    position: insertAt,
    color: NEW_STAGE_COLOR,
    kind: "open",
    role: null,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function updateStage(
  stageId: string,
  patch: { name?: string; kind?: StageKind; role?: StageRole | null }
): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "O nome da etapa não pode ficar vazio." };
    update.name = trimmed;
  }
  if (patch.role !== undefined) {
    if (patch.role !== null && !ROLES.includes(patch.role)) return { error: "Papel inválido." };
    update.role = patch.role;
  }

  const supabase = await createClient();

  if (patch.kind !== undefined) {
    if (!KINDS.includes(patch.kind)) return { error: "Tipo inválido." };
    // Trocar o tipo com cards dentro deixaria oportunidade "aberta" numa
    // etapa de ganho/perda (ou o contrário) — move os cards antes.
    const inside = await countOpportunitiesInStages(supabase, [stageId]);
    if (inside > 0) {
      const { data: current } = await supabase.from("crm_stages").select("kind").eq("id", stageId).single();
      if (current && current.kind !== patch.kind) {
        return { error: "Mova os cards dessa etapa antes de mudar o tipo dela (em andamento / ganho / perdido)." };
      }
    }
    update.kind = patch.kind;
  }

  if (Object.keys(update).length === 0) return {};
  const { data, error } = await supabase.from("crm_stages").update(update).eq("id", stageId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sem permissão pra editar essa etapa." };
  refresh();
  return {};
}

export async function reorderStages(pipelineId: string, orderedIds: string[]): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };

  const supabase = await createClient();
  const current = await listPipelineStages(supabase, pipelineId);
  const currentIds = new Set(current.map((s) => s.id));
  if (orderedIds.length !== current.length || orderedIds.some((id) => !currentIds.has(id))) {
    return { error: "A lista de etapas mudou — recarregue a página e tente de novo." };
  }

  for (let index = 0; index < orderedIds.length; index++) {
    const { error } = await supabase.from("crm_stages").update({ position: index }).eq("id", orderedIds[index]);
    if (error) return { error: error.message };
  }
  refresh();
  return {};
}

// Excluir etapa exige destino: os cards dela vão pro destino (que precisa
// ser do mesmo tipo — aberta pra aberta, ganha pra ganha, perdida pra
// perdida). O histórico fica (FK ON DELETE SET NULL). Nunca deixa o funil
// sem etapa de entrada, de ganho ou de perda.
export async function deleteStage(stageId: string, destinationStageId: string): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };
  if (stageId === destinationStageId) return { error: "Escolha uma etapa de destino diferente." };

  const supabase = await createClient();
  const { data: stage } = await supabase
    .from("crm_stages")
    .select("id, pipeline_id, kind, role")
    .eq("id", stageId)
    .single();
  if (!stage) return { error: "Etapa não encontrada." };

  const stages = await listPipelineStages(supabase, stage.pipeline_id);
  const destination = stages.find((s) => s.id === destinationStageId);
  if (!destination) return { error: "A etapa de destino precisa ser do mesmo pipeline." };
  if (destination.kind !== stage.kind) {
    return { error: "O destino precisa ser do mesmo tipo da etapa excluída (em andamento, ganho ou perdido)." };
  }
  if (stage.role === "lead" && !stages.some((s) => s.id !== stageId && s.role === "lead")) {
    return { error: 'Esse funil precisa de uma etapa "Novo lead" (papel de entrada). Dê esse papel a outra etapa antes.' };
  }

  const { error: moveError } = await supabase
    .from("crm_opportunities")
    .update({ stage_id: destinationStageId })
    .eq("stage_id", stageId);
  if (moveError) return { error: moveError.message };

  const { data: deleted, error } = await supabase.from("crm_stages").delete().eq("id", stageId).select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) return { error: "Sem permissão pra excluir essa etapa." };

  const remaining = stages.filter((s) => s.id !== stageId);
  for (let index = 0; index < remaining.length; index++) {
    await supabase.from("crm_stages").update({ position: index }).eq("id", remaining[index].id);
  }
  refresh();
  return {};
}

// Pipeline novo já nasce utilizável: entrada + ganho + perda.
export async function createPipeline(name: string): Promise<Result & { id?: string }> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Dê um nome pro pipeline." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("crm_pipelines")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pipeline, error } = await supabase
    .from("crm_pipelines")
    .insert({ name: trimmed, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !pipeline) return { error: error?.message ?? "Não deu pra criar o pipeline." };

  const { error: stagesError } = await supabase.from("crm_stages").insert([
    { pipeline_id: pipeline.id, name: "Novo lead", position: 0, color: "#FF007A", kind: "open", role: "lead" },
    { pipeline_id: pipeline.id, name: "Fechado", position: 1, color: "#22C55E", kind: "won", role: null },
    { pipeline_id: pipeline.id, name: "Perdido", position: 2, color: "#64748B", kind: "lost", role: null },
  ]);
  if (stagesError) {
    await supabase.from("crm_pipelines").delete().eq("id", pipeline.id);
    return { error: stagesError.message };
  }
  refresh();
  return { id: pipeline.id };
}

export async function renamePipeline(pipelineId: string, name: string): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };
  const trimmed = name.trim();
  if (!trimmed) return { error: "O nome do pipeline não pode ficar vazio." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_pipelines")
    .update({ name: trimmed })
    .eq("id", pipelineId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sem permissão pra editar esse pipeline." };
  refresh();
  return {};
}

// Só exclui pipeline sem oportunidades (aberta, fechada ou perdida) — os
// cards precisam ser movidos/encerrados antes — e nunca o último.
export async function deletePipeline(pipelineId: string): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { count: pipelineCount } = await supabase
    .from("crm_pipelines")
    .select("id", { count: "exact", head: true });
  if ((pipelineCount ?? 0) <= 1) return { error: "O CRM precisa ter pelo menos um pipeline." };

  const stages = await listPipelineStages(supabase, pipelineId);
  const inside = await countOpportunitiesInStages(
    supabase,
    stages.map((s) => s.id)
  );
  if (inside > 0) {
    return { error: `Esse pipeline ainda tem ${inside} oportunidade(s). Exclua ou encerre essas oportunidades antes de excluir o pipeline.` };
  }

  const { error: stagesError } = await supabase.from("crm_stages").delete().eq("pipeline_id", pipelineId);
  if (stagesError) return { error: stagesError.message };
  const { data: deleted, error } = await supabase.from("crm_pipelines").delete().eq("id", pipelineId).select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) return { error: "Sem permissão pra excluir esse pipeline." };
  refresh();
  return {};
}
