// Metas de vendas: fechamentos (quantidade) e receita fechada (R$). Existe uma
// meta da equipe (crm_goals.owner_id nulo) e, opcionalmente, uma por vendedor
// (owner_id = team_members.id). Valores mensais.
export const SALES_METRICS = ["fechamentos", "receita_fechada"] as const;

const BRT = 3;

// Início e fim do mês de Brasília que contém `date` (AAAA-MM-DD).
export function brtMonthRange(date: string) {
  const [y, m] = date.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, BRT));
  const end = new Date(Date.UTC(y, m, 1, BRT));
  const label = new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return { startIso: start.toISOString(), endIso: end.toISOString(), label };
}

export type SalesGoalMap = Record<string, { fechamentos?: number; receita_fechada?: number }>;
