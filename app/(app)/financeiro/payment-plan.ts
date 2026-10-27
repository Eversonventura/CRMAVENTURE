// Parcelamento — lógica pura (sem banco), testável por script.

// Soma meses mantendo o "dia" (31/01 + 1 mês = 28/02 ou 29/02).
export function addMonthsISO(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

// Divide o total em `count` parcelas mensais. Trabalha em centavos; o resto
// da divisão vai pra primeira parcela (as demais ficam iguais).
export function splitInstallments(total: number, count: number, firstDate: string) {
  const n = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  return Array.from({ length: n }, (_, i) => ({
    amount: (base + (i === 0 ? remainder : 0)) / 100,
    dueDate: addMonthsISO(firstDate, i),
  }));
}
