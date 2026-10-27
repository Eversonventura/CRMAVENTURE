// Cor de meta — verde: bateu (≥100%), amarelo: 70–99%, vermelho: abaixo de
// 70%. Em métricas "menor é melhor" (ex.: tarefas atrasadas) a lógica
// inverte. Pura: usada no Diário e, no sprint 185, na Visão geral.
export type GoalTone = "green" | "yellow" | "red";

export function classifyGoal(value: number, target: number, direction: "higher" | "lower" = "higher"): GoalTone {
  if (direction === "lower") {
    if (value <= target) return "green";
    if (value <= target * 1.3) return "yellow";
    return "red";
  }
  if (target <= 0) return "green";
  const ratio = value / target;
  if (ratio >= 1) return "green";
  if (ratio >= 0.7) return "yellow";
  return "red";
}

export const GOAL_TONE_CLASSES: Record<GoalTone, { bar: string; text: string; chip: string }> = {
  green: { bar: "bg-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700" },
  yellow: { bar: "bg-amber-400", text: "text-amber-700", chip: "bg-amber-50 text-amber-700" },
  red: { bar: "bg-red-500", text: "text-red-700", chip: "bg-red-50 text-red-700" },
};

// Metas da Visão geral (mensais; `crm_goals`, owner nulo). `scales`: metas de
// volume/valor crescem proporcionalmente em períodos maiores que um mês
// (90 dias = 3×, 12 meses = 12×); taxas e médias valem como estão.
export type GoalMetricDef = {
  key: string;
  label: string;
  unit: "count" | "money" | "percent" | "days";
  direction: "higher" | "lower";
  scales: boolean;
  fallback: number;
};

export const GOAL_METRICS: GoalMetricDef[] = [
  { key: "leads_recebidos", label: "Leads recebidos", unit: "count", direction: "higher", scales: true, fallback: 60 },
  { key: "reunioes_realizadas", label: "Reuniões realizadas", unit: "count", direction: "higher", scales: true, fallback: 8 },
  { key: "propostas_apresentadas", label: "Propostas apresentadas", unit: "count", direction: "higher", scales: true, fallback: 6 },
  { key: "fechamentos", label: "Negócios fechados", unit: "count", direction: "higher", scales: true, fallback: 3 },
  { key: "receita_fechada", label: "Receita fechada", unit: "money", direction: "higher", scales: true, fallback: 15000 },
  { key: "taxa_conversao", label: "Taxa de conversão", unit: "percent", direction: "higher", scales: false, fallback: 30 },
  { key: "ticket_medio", label: "Ticket médio", unit: "money", direction: "higher", scales: false, fallback: 3000 },
  { key: "tempo_medio_fechar", label: "Tempo médio até fechar", unit: "days", direction: "lower", scales: false, fallback: 30 },
  { key: "tarefas_atrasadas", label: "Tarefas atrasadas", unit: "count", direction: "lower", scales: false, fallback: 5 },
];
