import { createClient } from "@/lib/supabase/server";

export type CrmActivityType =
  | "mensagem"
  | "ligacao"
  | "email"
  | "reuniao"
  | "mudanca_etapa"
  | "tarefa"
  | "anotacao"
  | "arquivo"
  | "proposta"
  | "motivo_perda"
  | "automacao";

// Centraliza o registro na linha do tempo — chamada automaticamente
// sempre que uma tarefa é concluída, a etapa muda, uma proposta é
// criada, um motivo de perda é registrado, uma automação dispara, ou
// manualmente pelo vendedor (anotação/ligação/e-mail/mensagem/arquivo).
export async function logCrmActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opportunityId: string,
  type: CrmActivityType,
  content: string | null,
  fileUrl?: string | null
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("crm_activities").insert({
    opportunity_id: opportunityId,
    type,
    content,
    file_url: fileUrl ?? null,
    actor_id: user?.id ?? null,
  });
}
