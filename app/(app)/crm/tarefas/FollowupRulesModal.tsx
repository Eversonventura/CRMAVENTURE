"use client";

import { useState } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { applyRuleToExistingCards, deleteFollowupRule, saveFollowupRule } from "./followup-actions";
import { TASK_TYPE_LABELS, type TaskType } from "../types";
import type { FollowupRule } from "../followup-plan";

export type FollowupConfig = {
  rules: FollowupRule[];
  stages: { id: string; name: string; pipeline_id: string; kind: string; position: number }[];
  pipelines: { id: string; name: string }[];
};

const inputClass =
  "rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand";

type Draft = { taskType: string; intervalDays: string; repeat: boolean; dailyGoal: string; active: boolean };

function toDraft(rule: FollowupRule | undefined): Draft {
  return {
    taskType: rule?.task_type ?? "follow_up",
    intervalDays: String(rule?.interval_days ?? 3),
    repeat: rule?.repeat ?? true,
    dailyGoal: rule?.daily_goal != null ? String(rule.daily_goal) : "",
    active: rule?.active ?? true,
  };
}

function StageRuleRow({ stage, rule }: { stage: FollowupConfig["stages"][number]; rule: FollowupRule | undefined }) {
  const [draft, setDraft] = useState<Draft>(toDraft(rule));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasRule = !!rule;

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveFollowupRule(stage.id, {
      taskType: draft.taskType,
      intervalDays: Number(draft.intervalDays),
      repeat: draft.repeat,
      dailyGoal: draft.dailyGoal === "" ? null : Number(draft.dailyGoal),
      active: draft.active,
    });
    setBusy(false);
    setMessage(result.error ?? "Salvo.");
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{stage.name}</p>
        {!hasRule && <span className="text-[11px] text-muted">sem regra</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2 text-xs text-muted">
        <label className="flex flex-col gap-1">
          Tarefa
          <select
            value={draft.taskType}
            onChange={(e) => setDraft({ ...draft, taskType: e.target.value })}
            className={inputClass}
          >
            {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Em quantos dias
          <input
            type="number"
            min={0}
            max={365}
            value={draft.intervalDays}
            onChange={(e) => setDraft({ ...draft, intervalDays: e.target.value })}
            className={`${inputClass} w-20`}
          />
        </label>
        <label className="flex flex-col gap-1">
          Meta/dia
          <input
            type="number"
            min={0}
            value={draft.dailyGoal}
            onChange={(e) => setDraft({ ...draft, dailyGoal: e.target.value })}
            className={`${inputClass} w-16`}
            placeholder="—"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-2">
          <input
            type="checkbox"
            checked={draft.repeat}
            onChange={(e) => setDraft({ ...draft, repeat: e.target.checked })}
          />
          Repetir enquanto estiver na etapa
        </label>
        <label className="flex items-center gap-1.5 pb-2">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Ativa
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {hasRule ? "Salvar" : "Criar regra"}
        </button>
        {hasRule && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await applyRuleToExistingCards(stage.id);
                setBusy(false);
                setMessage(
                  result.error ??
                    (result.created
                      ? `${result.created} card(s) receberam a tarefa.`
                      : "Nenhum card precisava (todos já têm tarefa pendente).")
                );
              }}
              className="text-xs text-muted underline hover:text-ink"
            >
              Aplicar aos cards que já estão aqui
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await deleteFollowupRule(stage.id);
                setBusy(false);
                setMessage(result.error ?? "Regra removida.");
              }}
              className="text-xs text-muted hover:text-brand"
            >
              Remover regra
            </button>
          </>
        )}
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </div>
  );
}

export function FollowupRulesModal({ config, onClose }: { config: FollowupConfig; onClose: () => void }) {
  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">Configurar follow-ups</h2>
        <p className="mt-1 text-xs text-muted">
          Quando um card entra numa etapa, a tarefa da regra é agendada sozinha; ao sair da etapa, a tarefa
          automática pendente dela é cancelada (as tarefas que você criou à mão nunca são mexidas). Mover o card
          continua manual.
        </p>
        <div className="mt-4 space-y-5">
          {config.pipelines.map((pipeline) => (
            <div key={pipeline.id}>
              {config.pipelines.length > 1 && (
                <h3 className="mb-2 text-sm font-semibold text-ink">{pipeline.name}</h3>
              )}
              <div className="space-y-2">
                {config.stages
                  .filter((s) => s.pipeline_id === pipeline.id && s.kind === "open")
                  .map((stage) => (
                    <StageRuleRow
                      key={stage.id}
                      stage={stage}
                      rule={config.rules.find((r) => r.stage_id === stage.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-ink hover:border-brand"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
