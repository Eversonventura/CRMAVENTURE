import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type CrmRole = "administrador" | "gestor" | "vendedor";

export type WorkspaceSummary = {
  id: string;
  name: string;
  ownerId: string;
  memberId: string;
  role: CrmRole;
};

export type AccessContext = {
  workspaceId: string | null;
  workspaceName: string | null;
  workspaces: WorkspaceSummary[];
  crmRole: CrmRole | null;
  // Administrador da conta ativa: configura o CRM (etapas, cadência, metas, follow-ups) e a equipe.
  isFullAdmin: boolean;
  // Administrador ou gestor: mexe na cadência e nos follow-ups (o resto da configuração é só do administrador).
  isManager: boolean;
  // id do vínculo (team_members) da pessoa na conta ativa.
  teamMemberId: string | null;
};

// cache() do React memoiza por requisição: layout + página compartilham a consulta.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getAccessContext = cache(async (): Promise<AccessContext> => {
  const empty: AccessContext = {
    workspaceId: null,
    workspaceName: null,
    workspaces: [],
    crmRole: null,
    isFullAdmin: false,
    isManager: false,
    teamMemberId: null,
  };
  const user = await getCurrentUser();
  if (!user) return empty;

  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("id, crm_role, created_at, workspaces(id, name, owner_id)")
    .eq("profile_id", user.id)
    .order("created_at");

  type Row = {
    id: string;
    crm_role: CrmRole;
    workspaces: { id: string; name: string; owner_id: string } | { id: string; name: string; owner_id: string }[] | null;
  };
  const workspaces: WorkspaceSummary[] = [];
  for (const row of (data as Row[] | null) ?? []) {
    const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
    if (!ws) continue;
    workspaces.push({ id: ws.id, name: ws.name, ownerId: ws.owner_id, memberId: row.id, role: row.crm_role });
  }
  if (workspaces.length === 0) return empty;

  // Uma pessoa trabalha numa conta só (sem trocar). Mesma regra do banco (active_workspace_id): a conta
  // "Conta de <nome>" criada automaticamente no cadastro fica por último; vale a conta da empresa para a qual
  // a pessoa foi convidada ou que o Hub criou para ela.
  const isAutoOwnAccount = (w: WorkspaceSummary) => w.ownerId === user.id && w.name.startsWith("Conta de ");
  workspaces.sort((a, b) => Number(isAutoOwnAccount(a)) - Number(isAutoOwnAccount(b)));
  const active = workspaces[0];

  return {
    workspaceId: active.id,
    workspaceName: active.name,
    workspaces,
    crmRole: active.role,
    isFullAdmin: active.role === "administrador",
    isManager: active.role === "administrador" || active.role === "gestor",
    teamMemberId: active.memberId,
  };
});
