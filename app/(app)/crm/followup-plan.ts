// Lógica pura do agendamento de follow-ups (sem banco) — testável por script.

export type FollowupRule = {
  id: string;
  stage_id: string;
  task_type: string;
  interval_days: number;
  repeat: boolean;
  daily_goal: number | null;
  active: boolean;
};

// Vencimento = hoje + N dias (sempre em dia útil), às 09:00 de Brasília (12:00 UTC), pra a tarefa
// cair no começo do dia de trabalho e não "atrasar" por causa do fuso.
export function computeNextDue(from: Date, intervalDays: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + intervalDays);
  // Só dias úteis (segunda a sexta): sábado e domingo passam pra segunda.
  const weekday = d.getUTCDay();
  if (weekday === 6) d.setUTCDate(d.getUTCDate() + 2);
  else if (weekday === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

type PendingFollowup = { id: string; stage_id: string | null };

// Ao entrar numa etapa: cancela os follow-ups automáticos pendentes de OUTRAS
// etapas e agenda um novo só se a regra existir, estiver ativa e não houver
// já um pendente nessa etapa (sem duplicata).
export function planOnStageChange(args: {
  toStageId: string;
  rule: FollowupRule | null;
  pending: PendingFollowup[];
  opportunityOpen: boolean;
  now: Date;
}): { cancelIds: string[]; create: { type: string; dueAt: Date } | null } {
  const cancelIds = args.pending.filter((t) => t.stage_id !== args.toStageId).map((t) => t.id);
  const alreadyHere = args.pending.some((t) => t.stage_id === args.toStageId);
  if (!args.opportunityOpen || !args.rule || !args.rule.active || alreadyHere) {
    return { cancelIds, create: null };
  }
  return {
    cancelIds,
    create: { type: args.rule.task_type, dueAt: computeNextDue(args.now, args.rule.interval_days) },
  };
}

// Ao concluir um follow-up automático: reagenda se a regra repete e o card
// ainda está na mesma etapa, aberto e sem outro pendente.
export function planOnComplete(args: {
  taskStageId: string | null;
  currentStageId: string | null;
  rule: FollowupRule | null;
  opportunityOpen: boolean;
  hasPendingHere: boolean;
  now: Date;
}): { type: string; dueAt: Date } | null {
  const { rule } = args;
  if (!rule || !rule.active || !rule.repeat) return null;
  if (!args.opportunityOpen || args.hasPendingHere) return null;
  if (!args.taskStageId || args.taskStageId !== args.currentStageId) return null;
  return { type: rule.task_type, dueAt: computeNextDue(args.now, rule.interval_days) };
}
