"use client";

import { useState } from "react";
import Link from "next/link";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { GOAL_METRICS } from "./goals";
import { saveCrmGoals, saveMemberSalesGoals } from "./goal-actions";
import type { SalesGoalMap } from "./sales-goals";

const UNIT_SUFFIX = { count: "", money: "R$", percent: "%", days: "dias" } as const;

export function GoalsEditor({
  targets,
  members = [],
  memberGoals = {},
}: {
  targets: Record<string, number>;
  members?: { id: string; name: string }[];
  memberGoals?: SalesGoalMap;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(GOAL_METRICS.map((m) => [m.key, String(targets[m.key] ?? m.fallback)]))
  );
  // Metas de vendas por vendedor: campo vazio = sem meta pessoal.
  const [personal, setPersonal] = useState<Record<string, { fechamentos: string; receita: string }>>(
    Object.fromEntries(
      members.map((m) => [
        m.id,
        {
          fechamentos: memberGoals[m.id]?.fechamentos !== undefined ? String(memberGoals[m.id].fechamentos) : "",
          receita: memberGoals[m.id]?.receita_fechada !== undefined ? String(memberGoals[m.id].receita_fechada) : "",
        },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveCrmGoals(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])));
    const personalResult =
      result.error || members.length === 0
        ? result
        : await saveMemberSalesGoals(
            members.map((m) => ({
              memberId: m.id,
              fechamentos: personal[m.id].fechamentos.trim() === "" ? null : Number(personal[m.id].fechamentos),
              receita_fechada: personal[m.id].receita.trim() === "" ? null : Number(personal[m.id].receita),
            }))
          );
    setBusy(false);
    if (personalResult.error) setError(personalResult.error);
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
            {members.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="font-display text-base font-medium text-ink">Metas de vendas por vendedor</h3>
                <p className="mt-1 text-xs text-muted">
                  Fechamentos e receita fechada por mês, para cada pessoa. Deixe em branco para não ter meta pessoal. As metas
                  de &quot;Negócios fechados&quot; e &quot;Receita fechada&quot; acima são as da equipe.
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-[1fr_5.5rem_7.5rem] gap-2 text-xs text-muted">
                    <span>Vendedor</span>
                    <span>Fechamentos</span>
                    <span>Receita (R$)</span>
                  </div>
                  {members.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_5.5rem_7.5rem] items-center gap-2">
                      <span className="truncate text-ink">{m.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={personal[m.id].fechamentos}
                        onChange={(e) => setPersonal({ ...personal, [m.id]: { ...personal[m.id], fechamentos: e.target.value } })}
                        className="rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                      />
                      <input
                        type="number"
                        min={0}
                        value={personal[m.id].receita}
                        onChange={(e) => setPersonal({ ...personal, [m.id]: { ...personal[m.id], receita: e.target.value } })}
                        className="rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-5 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
              A <strong>meta olímpica</strong> (Bronze, Prata, Ouro e RMV, por faturamento ou por contratos) fica em{" "}
              <Link href="/crm/configuracoes#meta-olimpica" className="text-brand hover:underline">
                Configurações
              </Link>
              .
            </p>

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
