"use client";

import { useState } from "react";
import { updateProposalValue } from "../actions";

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Valor da proposta = estimated_value da oportunidade (uma fonte só, igual
// no funil). Editar aqui atualiza o card do funil e a Visão geral.
export function ValueCell({ opportunityId, value }: { opportunityId: string; value: number | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const parsed = draft.trim() === "" ? null : Number(draft.replace(",", "."));
    const result = await updateProposalValue(opportunityId, parsed);
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setError(null);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value === null ? "" : String(value));
          setEditing(true);
        }}
        className="text-ink hover:text-brand"
        title="Editar valor"
      >
        {formatCurrency(value)}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        inputMode="decimal"
        className="w-28 rounded-md border border-border bg-surface2 px-2 py-1 text-sm text-ink outline-none focus:border-brand"
      />
      <button type="button" disabled={busy} onClick={save} className="text-xs font-medium text-brand">
        OK
      </button>
      {error && <span className="text-xs text-brand">{error}</span>}
    </span>
  );
}
