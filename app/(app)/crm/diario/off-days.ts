// Dias sem prospecção — lógica pura (sem banco), testável por script.
// Datas são strings "AAAA-MM-DD" no dia de Brasília (UTC-3).
const BRT_OFFSET_MS = 3 * 3600000;

export function brtDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6;
}

// Empurra um vencimento pra frente enquanto cair em fim de semana ou num dia
// sem prospecção. Mantém o horário.
export function skipOffDays(due: Date, offDates: Set<string>): Date {
  let result = new Date(due);
  for (let i = 0; i < 60; i++) {
    const date = brtDateOf(result.toISOString());
    if (!isWeekend(date) && !offDates.has(date)) break;
    result = new Date(result.getTime() + 24 * 3600000);
  }
  return result;
}

export const MEETING_TYPES = ["agendar_reuniao", "realizar_reuniao"];
export const DAILY_FOLLOWUP_CAP = 10;

type MovableTask = { id: string; due_at: string; source: string; type: string };

// Reagenda as tarefas dos dias marcados. Follow-ups automáticos vão pro
// próximo dia útil sem marcação, no máximo `cap` por dia (o excedente
// escorre pro dia seguinte — não vira bola de neve num dia só). As demais
// tarefas manuais mudam de dia mantendo o horário. Reuniões nunca entram.
export function planOffDayReschedule(args: {
  tasks: MovableTask[];
  offDates: Set<string>;
  load: Map<string, number>; // follow-ups já agendados por dia (fora os que estão sendo movidos)
  cap?: number;
}): { id: string; newDueIso: string }[] {
  const cap = args.cap ?? DAILY_FOLLOWUP_CAP;
  const load = new Map(args.load);
  const out: { id: string; newDueIso: string }[] = [];
  const sorted = [...args.tasks]
    .filter((t) => !MEETING_TYPES.includes(t.type))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  for (const t of sorted) {
    const original = brtDateOf(t.due_at);
    let target = addDays(original, 1);
    const isFollowup = t.source === "followup";
    for (let i = 0; i < 90; i++) {
      const blocked = isWeekend(target) || args.offDates.has(target);
      const full = isFollowup && (load.get(target) ?? 0) >= cap;
      if (!blocked && !full) break;
      target = addDays(target, 1);
    }
    if (isFollowup) {
      load.set(target, (load.get(target) ?? 0) + 1);
      out.push({ id: t.id, newDueIso: `${target}T12:00:00.000Z` });
    } else {
      const orig = new Date(t.due_at);
      // mesmo horário local, no dia novo
      const localMs = orig.getTime() - BRT_OFFSET_MS;
      const midnightLocal = new Date(`${original}T00:00:00Z`).getTime();
      const dayOffset = localMs - midnightLocal;
      out.push({ id: t.id, newDueIso: new Date(new Date(`${target}T00:00:00Z`).getTime() + dayOffset + BRT_OFFSET_MS).toISOString() });
    }
  }
  return out;
}
