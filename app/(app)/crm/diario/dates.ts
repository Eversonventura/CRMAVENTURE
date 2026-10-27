// "Hoje" do Diário é o dia de Brasília (UTC-3, sem horário de verão), não o
// do servidor (UTC) — senão a lista virava às 21h.
const BRT_OFFSET_HOURS = 3;

export function brtToday(now: Date = new Date()) {
  const shifted = new Date(now.getTime() - BRT_OFFSET_HOURS * 3600000);
  const date = shifted.toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCHours(BRT_OFFSET_HOURS);
  const end = new Date(start.getTime() + 24 * 3600000);
  // Dia da semana em Brasília (0 = domingo … 6 = sábado). Prospecção é de
  // segunda a sexta: sábado e domingo não têm meta nem abordagens.
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return {
    date,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    weekday,
    isBusinessDay: weekday >= 1 && weekday <= 5,
    // Atrasada = venceu antes do último dia útil. Na segunda, o que venceu
    // no fim de semana ainda é "de hoje", não atraso.
    overdueCutoffIso: new Date(start.getTime() - (weekday === 1 ? 2 : 0) * 24 * 3600000).toISOString(),
  };
}

export function daysOverdue(dueAt: string, startIso: string) {
  return Math.max(1, Math.ceil((new Date(startIso).getTime() - new Date(dueAt).getTime()) / 86400000));
}

// Semana de segunda a domingo (dia de Brasília) que contém `date`.
export function brtWeek(date: string) {
  const wd = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  const mondayDate = new Date(`${date}T12:00:00.000Z`);
  mondayDate.setUTCDate(mondayDate.getUTCDate() - ((wd + 6) % 7));
  const monday = mondayDate.toISOString().slice(0, 10);
  const start = new Date(`${monday}T00:00:00.000Z`);
  start.setUTCHours(BRT_OFFSET_HOURS);
  const end = new Date(start.getTime() + 7 * 24 * 3600000);
  const weekdays = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(`${monday}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  return { monday, startIso: start.toISOString(), endIso: end.toISOString(), weekdays };
}
