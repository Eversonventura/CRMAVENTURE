"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_METRICS } from "./goals";
import type { SalesMode } from "./business";
import { saveCrmGoals, saveMemberSalesGoals } from "./goal-actions";
import type { SalesGoalMap } from "./sales-goals";

const UNIT_SUFFIX = { count: "", money: "R$", percent: "%", days: "dias" } as const;

export function GoalsForm({
  targets,
  members = [],
  memberGoals = {},
  salesMode = "valor",
}: {
  salesMode?: SalesMode;
  targets: Record<string, number>;
  members?: { id: string; name: string }[];
  memberGoals?: SalesGoalMap;
}) {
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
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const byContracts = salesMode === "contratos";
  // Meta por contratos: sem valores (receita e ticket médio saem); o "Negócios fechados" vira "Contratos fechados".
  const metrics = GOAL_METRICS.filter((m) => !byContracts || !(m.key === "receita_fechada" || m.key === "ticket_medio")).map((m) => {
    if (m.key === "fechamentos") return { ...m, label: byContracts ? "Contratos fechados" : "Negócios fechados" };
    if (m.key === "propostas_apresentadas") return { ...m, label: "Propostas / contratos apresentados" };
    return m;
  });

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveCrmGoals(
        Object.fromEntries(metrics.map((m) => [m.key, Number(values[m.key])]))
      );
      const personalResult =
        result.error || members.length === 0
          ? result
          : await saveMemberSalesGoals(
              members.map((m) => ({
                memberId: m.id,
                fechamentos: personal[m.id].fechamentos.trim() === "" ? null : Number(personal[m.id].fechamentos),
                ...(byContracts ? {} : { receita_fechada: personal[m.id].receita.trim() === "" ? null : Number(personal[m.id].receita) }),
              }))
            );
      if (personalResult.error) setError(personalResult.error);
      else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Não foi possível salvar agora. Verifique a conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-muted">
        Verde: bateu a meta · amarelo: 70% a 99% · vermelho: abaixo de 70%. Em &quot;menor é melhor&quot; (tempo,
        atrasadas) a lógica inverte. Em períodos maiores, as metas de volume e valor multiplicam (90 dias = 3×).
      </p>
      <div className="mt-4 space-y-2.5 text-sm">
        {metrics.map((m) => (
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
            {byContracts ? "Contratos fechados por mês" : "Fechamentos e receita fechada por mês"}, para cada pessoa. Deixe em branco para não ter meta pessoal. As metas
            de &quot;Negócios fechados&quot; e &quot;Receita fechada&quot; acima são as da equipe.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className={`grid ${byContracts ? "grid-cols-[1fr_7rem]" : "grid-cols-[1fr_5.5rem_7.5rem]"} gap-2 text-xs text-muted`}>
              <span>Vendedor</span>
              <span>Fechamentos</span>
              <span>Receita (R$)</span>
            </div>
            {members.map((m) => (
              <div key={m.id} className={`grid ${byContracts ? "grid-cols-[1fr_7rem]" : "grid-cols-[1fr_5.5rem_7.5rem]"} items-center gap-2`}>
                <span className="truncate text-ink">{m.name}</span>
                <input
                  type="number"
                  min={0}
                  value={personal[m.id].fechamentos}
                  onChange={(e) => setPersonal({ ...personal, [m.id]: { ...personal[m.id], fechamentos: e.target.value } })}
                  className="rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                />
                {!byContracts && (
                  <input
                    type="number"
                    min={0}
                    value={personal[m.id].receita}
                    onChange={(e) => setPersonal({ ...personal, [m.id]: { ...personal[m.id], receita: e.target.value } })}
                    className="rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-brand">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar metas"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Metas salvas.</span>}
      </div>
    </div>
  );
}
