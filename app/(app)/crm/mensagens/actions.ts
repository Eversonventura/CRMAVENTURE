"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { MESSAGE_KINDS, type MessageKind, type MessageTemplate } from "../messages";

type Result = { error?: string };

const KINDS = MESSAGE_KINDS.map((k) => k.kind);

// Para o card do lead: modelos ativos e o nome de quem está logado ({vendedor}).
export async function listActiveTemplates(): Promise<{ templates: MessageTemplate[]; me: string | null }> {
  const supabase = await createClient();
  const access = await getAccessContext();
  const [{ data }, { data: me }] = await Promise.all([
    supabase.from("crm_message_templates").select("id, kind, title, body, position, active").eq("active", true).order("position"),
    access.teamMemberId
      ? supabase.from("team_members").select("full_name").eq("id", access.teamMemberId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { templates: (data as MessageTemplate[] | null) ?? [], me: (me as { full_name: string } | null)?.full_name ?? null };
}

async function requireAdmin(): Promise<string | null> {
  const access = await getAccessContext();
  return access.isFullAdmin ? null : "Só o administrador da conta edita as mensagens.";
}

export async function saveTemplate(input: { id?: string; kind: MessageKind; title: string; body: string; active?: boolean }): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };
  if (!KINDS.includes(input.kind)) return { error: "Tipo de mensagem inválido." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { error: "Dê um título para a mensagem." };
  if (!body) return { error: "Escreva o texto da mensagem." };
  if (body.length > 2000) return { error: "A mensagem passa de 2.000 caracteres." };

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("crm_message_templates").update({ kind: input.kind, title, body, active: input.active ?? true }).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase.from("crm_message_templates").select("id", { count: "exact", head: true }).eq("kind", input.kind);
    const { error } = await supabase.from("crm_message_templates").insert({ kind: input.kind, title, body, position: count ?? 0, active: true });
    if (error) return { error: error.message };
  }
  revalidatePath("/crm/mensagens");
  return {};
}

export async function setTemplateActive(id: string, active: boolean): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_message_templates").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/crm/mensagens");
  return {};
}

export async function deleteTemplate(id: string): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_message_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/crm/mensagens");
  return {};
}
