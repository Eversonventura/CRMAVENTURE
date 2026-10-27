import { cache } from "react";
import { getAccessContext } from "@/lib/access";
import type { CrmRole } from "./types";

export type CrmAccessContext = {
  teamMemberId: string | null;
  crmRole: CrmRole | null;
  canSeeAll: boolean;
};

// crm_can_see_all() no banco é a fonte de verdade (usada pela RLS) — isto só
// espelha a regra para a UI (toda a carteira vs. "minhas oportunidades").
export const getCrmAccessContext = cache(async (): Promise<CrmAccessContext> => {
  const access = await getAccessContext();
  const crmRole = access.crmRole;
  return {
    teamMemberId: access.teamMemberId,
    crmRole,
    canSeeAll: crmRole === "administrador" || crmRole === "gestor",
  };
});
