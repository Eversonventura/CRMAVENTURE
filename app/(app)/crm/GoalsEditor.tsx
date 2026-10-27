"use client";

import { useState } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { GOAL_METRICS } from "./goals";
import { saveCrmGoals, saveOlympicGoals } from "./goal-actions";
import { OLYMPIC_DEFAULTS, olympicTargets, type OlympicSettings } from "./olympic";

const UNIT_SUFFIX = { count: "", money: "R$", percent: "%", days: "dias" } as const;

export function GoalsEditor({ targets, olympic }: { targets: Record<string, number>; olympic: OlympicSettings }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(GOAL_METRICS.map((m) => [m.key, String(targets[m.key] ?? m.fallback)]))
  );
  const [olympicValues, setOlympicValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries({ ...OLYMPIC_DEFAULTS, ...olympic }).map(([k, v]) => [k, String(v)]))
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = olympicTargets(
    Object.fromEntries(Object.entries(olympicValues).map(([k, v]) => [k, Number(v) || 0])) as unknown as OlympicSettings
  );
  const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveCrmGoals(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])));
    const olympicResult = result.error
      ? result
      : await saveOlympicGoals(Object.fromEntries(Object.entries(olympicValues).map(([k, v]) => [k, Number(v) || 0])));
    setBusy(false);
    if (olympicResult.error) setError(olympicResult.error);
    else setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink hover:border-brand"
      >
        Metas
      </button>
      {open && (
        <ModalBackdrop dirty={false} onClose={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl font-medium text-ink">Metas do mês</h2>
            <p className="mt-1 text-xs text-muted">
              Verde: bateu a meta · amarelo: 70% a 99% · vermelho: abaixo de 70%. Em &quot;menor é melhor&quot; (tempo,
              atrasadas) a lógica inverte. Em períodos maiores, as metas de volume e valor multiplicam (90 dias = 3×).
            </p>
            <div className="mt-4 space-y-2.5 text-sm">
              {GOAL_METRICS.map((m) => (
                <label key={m.key} className="flex items-center justify-between gap-3">
                  <span className="text-ink">
                    {m.label}
                    {m.direction === "lower" && <span className="text-xs text-muted"> (menor é melhor)</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={values[m.key]}
                      onChange={(e) => setValues({ ...values, [m.key]: e.target.value })}
                      className="w-24 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                    />
                    <span className="w-8 text-xs text-muted">{UNIT_SUFFIX[m.unit]}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="font-display text-base font-medium text-ink">Metas olímpicas e RMV</h3>
              <p className="mt-1 text-xs text-muted">
                Base corrigida = ponto de partida × (1 + inflação). Bronze/Prata/Ouro = base × (1 + crescimento). RMV = multiplicador × Ouro
                (ou um valor fixo). Contam só dinheiro novo recebido no mês.
              </p>
              <div className="mt-3 space-y-2.5 text-sm">
                {(
                  [
                    ["olympic_base", "Ponto de partida mensal", "R$"],
                    ["olympic_inflation", "Inflação projetada", "%"],
                    ["olympic_bronze", "Bronze — crescimento", "%"],
                    ["olympic_silver", "Prata — crescimento", "%"],
                    ["olympic_gold", "Ouro — crescimento", "%"],
                    ["rmv_multiplier", "RMV = Ouro ×", "×"],
                    ["rmv_manual", "RMV fixo (0 = usar a fórmula)", "R$"],
                  ] as const
                ).map(([key, label, suffix]) => (
                  <label key={key} className="flex items-center justify-between gap-3">
                    <span className="text-ink">{label}</span>
                    <span className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={olympicValues[key]}
                        onChange={(e) => setOlympicValues({ ...olympicValues, [key]: e.target.value })}
                        className="w-24 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                      />
                      <span className="w-6 text-xs text-muted">{suffix}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
                Resulta em: Bronze {money(preview.bronze)} · Prata {money(preview.silver)} · Ouro {money(preview.gold)} · RMV {money(preview.rmv)}
              </p>
            </div>

            {error && <p className="mt-3 text-sm text-brand">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-ink">
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60">
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
