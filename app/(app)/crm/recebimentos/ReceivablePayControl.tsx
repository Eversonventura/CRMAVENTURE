"use client";

import { useState, useTransition } from "react";
import { markReceivablePaid } from "../../financeiro/receivables-actions";

// "Dar baixa" com a DATA em que o dinheiro entrou (padrão: hoje). Aceita data
// passada ou futura: a parcela conta no mês dessa data (ex.: boleto de novembro
// que será pago em novembro).
export function ReceivablePayControl({ id, label = "Dar baixa" }: { id: string; label?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-border bg-surface2 px-1.5 py-0.5 text-xs text-ink"
        aria-label="Data em que foi recebido"
        title="Data em que o dinheiro entra (pode ser uma data futura)"
      />
      <button
        type="button"
        disabled={pending || !date}
        onClick={() =>
          start(async () => {
            const result = await markReceivablePaid(id, date);
            setError(result.error ?? null);
          })
        }
        className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {label}
      </button>
      {error && <span className="text-xs text-brand">{error}</span>}
    </span>
  );
}
