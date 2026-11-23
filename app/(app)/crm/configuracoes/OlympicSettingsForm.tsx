"use client";

import { useState } from "react";
import { saveOlympicGoals } from "../goal-actions";
import { OLYMPIC_DEFAULTS, olympicTargets, type OlympicSettings } from "../olympic";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const input = "w-24 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand";

// Meta olímpica: contar o mês por VALOR vendido (R$) ou por CONTRATOS fechados.
export function OlympicSettingsForm({ settings }: { settings: OlympicSettings }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries({ ...OLYMPIC_DEFAULTS, ...settings }).map(([k, v]) => [k, String(v)]))
  );
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = olympicTargets(
    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0])) as unknown as OlympicSettings
  );
  const byContracts = values.olympic_mode === "1";

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveOlympicGoals(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0])));
    setBusy(false);
    setMessage(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "Meta olímpica salva." });
  }

  const row = (key: string, label: string, suffix: string, step: string | number = "any") => (
    <label key={key} className="flex items-center justify-between gap-3">
      <span className="text-ink">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step={step}
          value={values[key]}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          className={input}
        />
        <span className="w-16 text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );

  return (
    <div>
      <p className="text-xs text-muted">
        A meta olímpica conta as <strong>vendas fechadas no mês</strong>. Escolha como medir:
      </p>
      <div className="mt-2 grid max-w-xl grid-cols-2 gap-2 text-sm">
        {(
          [
            ["0", "Por faturamento", "soma, em R$, das vendas fechadas"],
            ["1", "Por contratos fechados", "quantidade de contratos fechados"],
          ] as const
        ).map(([val, label, hint]) => (
          <button
            key={val}
            type="button"
            onClick={() => setValues({ ...values, olympic_mode: val })}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              values.olympic_mode === val ? "border-brand bg-brand-soft text-brand" : "border-border text-ink hover:border-brand"
            }`}
          >
            <span className="block font-medium">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </button>
        ))}
      </div>

      {byContracts ? (
        <>
          <p className="mt-4 text-xs text-muted">
            Quantos contratos fechados no mês para cada medalha (fechamentos do fluxo e vendas avulsas; comissão não conta como contrato).
          </p>
          <div className="mt-3 max-w-md space-y-2.5 text-sm">
            {row("olympic_count_bronze", "Bronze", "contratos", 1)}
            {row("olympic_count_silver", "Prata", "contratos", 1)}
            {row("olympic_count_gold", "Ouro", "contratos", 1)}
            {row("olympic_count_rmv", "RMV", "contratos", 1)}
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted">
            Base corrigida = ponto de partida × (1 + inflação). Bronze/Prata/Ouro = base × (1 + crescimento). RMV = multiplicador × Ouro (ou um valor fixo).
          </p>
          <div className="mt-3 max-w-md space-y-2.5 text-sm">
            {row("olympic_base", "Ponto de partida mensal", "R$")}
            {row("olympic_inflation", "Inflação projetada", "%")}
            {row("olympic_bronze", "Bronze — crescimento", "%")}
            {row("olympic_silver", "Prata — crescimento", "%")}
            {row("olympic_gold", "Ouro — crescimento", "%")}
            {row("rmv_multiplier", "RMV = Ouro ×", "×")}
            {row("rmv_manual", "RMV fixo (0 = usar a fórmula)", "R$")}
          </div>
          <p className="mt-3 max-w-xl rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
            Resulta em: Bronze {money(preview.bronze)} · Prata {money(preview.silver)} · Ouro {money(preview.gold)} · RMV {money(preview.rmv)}
          </p>
        </>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar meta olímpica"}
        </button>
        {message && <span className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-brand"}`}>{message.text}</span>}
      </div>
    </div>
  );
}
