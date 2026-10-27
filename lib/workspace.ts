// Conta (workspace) ativa. O app guarda a escolha num cookie e a envia em todo
// pedido ao Supabase no header `x-workspace-id`; o banco só honra se a pessoa
// for membro dessa conta (ver active_workspace_id() em supabase/schema.sql).
export const WS_COOKIE = "crm_ws";
export const WS_HEADER = "x-workspace-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanWorkspaceId(value: string | undefined | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}
