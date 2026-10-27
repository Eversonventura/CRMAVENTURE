"use client";

import { useState } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { createStage, deleteStage, reorderStages, updateStage } from "./stage-actions";
import { StageColorPicker } from "./StageColorPicker";
import {
  STAGE_KIND_LABELS,
  STAGE_ROLE_LABELS,
  type CrmStage,
  type StageKind,
  type StageRole,
} from "../types";

const inputClass =
  "rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

// Gerenciador de etapas do pipeline atual: renomear, cor, papel (alimenta
// o Diário e as regras de follow-up), tipo, reordenar e excluir (com
// destino pros cards). Cada alteração salva na hora.
export function StageManagerModal({
  pipelineId,
  stages,
  cardCountByStage,
  onClose,
}: {
  pipelineId: string;
  stages: CrmStage[];
  cardCountByStage: Record<string, number>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<CrmStage | null>(null);
  const [destination, setDestination] = useState("");

  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result?.error) setError(result.error);
    return !result?.error;
  }

  async function move(index: number, delta: -1 | 1) {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await run(() => reorderStages(pipelineId, next.map((s) => s.id)));
  }

  const candidates = deleting ? stages.filter((s) => s.id !== deleting.id && s.kind === deleting.kind) : [];

  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">Etapas do funil</h2>
        <p className="mt-1 text-xs text-muted">
          O <strong>papel</strong> diz ao sistema o que a etapa representa (Diário, follow-ups e automações usam
          isso, não o nome) — pode renomear à vontade. Mudanças salvam na hora.
        </p>

        <div className="mt-4 space-y-2">
          {stages.map((stage, index) => (
            <div key={stage.id} className="rounded-lg border border-border p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <StageColorPicker stageId={stage.id} color={stage.color} size={18} />
                <input
                  defaultValue={stage.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== stage.name) run(() => updateStage(stage.id, { name: value }));
                  }}
                  className={`${inputClass} min-w-[160px] flex-1 font-medium`}
                  aria-label="Nome da etapa"
                />
                <select
                  defaultValue={stage.role ?? ""}
                  onChange={(e) =>
                    run(() => updateStage(stage.id, { role: (e.target.value || null) as StageRole | null }))
                  }
                  className={inputClass}
                  aria-label="Papel da etapa"
                  title="Papel no processo comercial"
                >
                  <option value="">Sem papel especial</option>
                  {(Object.keys(STAGE_ROLE_LABELS) as StageRole[]).map((r) => (
                    <option key={r} value={r}>
                      {STAGE_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <select
                  defaultValue={stage.kind}
                  onChange={async (e) => {
                    const ok = await run(() => updateStage(stage.id, { kind: e.target.value as StageKind }));
                    if (!ok) e.target.value = stage.kind;
                  }}
                  className={inputClass}
                  aria-label="Tipo da etapa"
                >
                  {(Object.keys(STAGE_KIND_LABELS) as StageKind[]).map((k) => (
                    <option key={k} value={k}>
                      {STAGE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-30"
                    aria-label="Mover pra cima / esquerda"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === stages.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-30"
                    aria-label="Mover pra baixo / direita"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(stage);
                      setDestination("");
                      setError(null);
                    }}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:text-brand"
                    aria-label="Excluir etapa"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="mt-1 pl-7 text-[11px] text-muted">
                {cardCountByStage[stage.id] ?? 0} card(s) nessa etapa
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                run(() => createStage(pipelineId, newName)).then((ok) => ok && setNewName(""));
              }
            }}
            placeholder="Nova etapa (entra antes de Fechado/Perdido)"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={() => run(() => createStage(pipelineId, newName)).then((ok) => ok && setNewName(""))}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            + Adicionar
          </button>
        </div>

        {deleting && (
          <div className="mt-4 rounded-lg border border-brand/40 bg-brand-soft/40 p-3.5">
            <p className="text-sm text-ink">
              Excluir <strong>{deleting.name}</strong>?{" "}
              {(cardCountByStage[deleting.id] ?? 0) > 0
                ? `Os ${cardCountByStage[deleting.id]} card(s) dela vão pra etapa que você escolher.`
                : "Não há cards nela."}{" "}
              O histórico dos cards é mantido.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={inputClass}
                aria-label="Etapa de destino"
              >
                <option value="">Escolha a etapa de destino…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !destination}
                onClick={async () => {
                  const ok = await run(() => deleteStage(deleting.id, destination));
                  if (ok) setDeleting(null);
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Excluindo..." : "Excluir etapa"}
              </button>
              <button type="button" onClick={() => setDeleting(null)} className="text-sm text-muted hover:text-ink">
                Cancelar
              </button>
            </div>
            {candidates.length === 0 && (
              <p className="mt-2 text-xs text-brand">
                Não há outra etapa do mesmo tipo pra receber os cards — crie uma antes.
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-brand">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-ink transition hover:border-brand"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
