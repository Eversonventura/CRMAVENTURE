"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  cancelTaskAction,
  markMeetingNotHeld,
  completeTaskAction,
  completeTaskAndAdvance,
  getNextStage,
  createTaskAction,
  type CrmFormState,
} from "../actions";
import { FollowupRulesModal, type FollowupConfig } from "./FollowupRulesModal";
import { TASK_TYPE_LABELS, type CrmTask, type TaskType, type TeamMemberOption } from "../types";

function formatDueAt(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isOverdue(dueAt: string) {
  return new Date(dueAt).getTime() < Date.now();
}

export function CompleteTaskModal({
  task,
  teamMembers,
  onClose,
}: {
  task: CrmTask;
  teamMembers: TeamMemberOption[];
  onClose: () => void;
}) {
  const [activityResult, setActivityResult] = useState("");
  const [skipNext, setSkipNext] = useState(task.source === "followup");
  const [nextType, setNextType] = useState<TaskType | "">("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [nextResponsible, setNextResponsible] = useState(task.responsible_id ?? "");
  const [nextDescription, setNextDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nextStage, setNextStage] = useState<{ id: string; name: string } | null>(null);

  // Próxima etapa do funil (se houver) pro botão "Respondeu → próxima etapa".
  useEffect(() => {
    let active = true;
    getNextStage(task.opportunity_id).then((stage) => {
      if (active) setNextStage(stage);
    });
    return () => {
      active = false;
    };
  }, [task.opportunity_id]);

  function handleAdvance() {
    if (!nextStage) return;
    setError(null);
    startTransition(async () => {
      const result = await completeTaskAndAdvance(task.id, activityResult, task.opportunity_id, nextStage.id);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  function handleSave() {
    if (!skipNext && (!nextType || !nextDueAt)) {
      setError("Defina o tipo e a data da próxima ação, ou marque \"sem próxima ação\".");
      return;
    }
    setError(null);
    startTransition(async () => {
      await completeTaskAction(
        task.id,
        activityResult,
        skipNext
          ? null
          : {
              opportunityId: task.opportunity_id,
              type: nextType,
              dueAt: nextDueAt,
              responsibleId: nextResponsible || null,
              priority: null,
              description: nextDescription || null,
            }
      );
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-medium text-ink">Concluir tarefa</h2>
        <p className="mt-1 text-sm text-muted">
          {TASK_TYPE_LABELS[task.type]} — {task.companyName}
        </p>

        <div className="mt-4 space-y-1.5">
          <label className="text-xs text-muted">Resultado (opcional)</label>
          <textarea
            value={activityResult}
            onChange={(e) => setActivityResult(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        {nextStage && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleAdvance}
            className="mt-4 w-full rounded-lg border border-brand bg-brand-soft px-3.5 py-2.5 text-sm font-medium text-brand transition hover:bg-brand hover:text-white disabled:opacity-60"
          >
            Respondeu → concluir e ir para &quot;{nextStage.name}&quot;
          </button>
        )}

        {!skipNext && (
          <div className="mt-4 space-y-3 rounded-lg border border-dashed border-brand bg-brand-soft/40 p-3">
            <p className="text-sm font-medium text-ink">Qual é a próxima ação?</p>
            <div>
              <label className="text-xs text-muted">Tipo *</label>
              <select
                value={nextType}
                onChange={(e) => setNextType(e.target.value as TaskType)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Selecione...</option>
                {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Data/hora *</label>
              <input
                type="datetime-local"
                value={nextDueAt}
                onChange={(e) => setNextDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Responsável</label>
              <select
                value={nextResponsible}
                onChange={(e) => setNextResponsible(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Selecione...</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Descrição</label>
              <input
                value={nextDescription}
                onChange={(e) => setNextDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setSkipNext((v) => !v)}
          className="mt-2 text-xs text-muted underline hover:text-ink"
        >
          {skipNext ? "Quero definir a próxima ação" : "Sem próxima ação por agora"}
        </button>
        {skipNext && task.source === "followup" && (
          <p className="mt-1 text-xs text-muted">
            O próximo follow-up é agendado automaticamente (conforme a regra da etapa) se o lead continuar nela.
          </p>
        )}

        {error && <p className="mt-2 text-sm text-brand">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted transition hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Concluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTaskForm({
  teamMembers,
  opportunities,
}: {
  teamMembers: TeamMemberOption[];
  opportunities: { id: string; companyName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CrmFormState, FormData>(createTaskAction, {});
  const prevPending = useRef(pending);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    prevPending.current = pending;
  }, [pending, state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
      >
        + Nova tarefa
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2"
    >
      <div className="space-y-1">
        <label className="text-xs text-muted">Oportunidade *</label>
        <select
          name="opportunity_id"
          required
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        >
          <option value="">Selecione...</option>
          {opportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.companyName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted">Tipo *</label>
        <select
          name="type"
          required
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        >
          {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted">Data/hora *</label>
        <input
          type="datetime-local"
          name="due_at"
          required
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted">Responsável</label>
        <select
          name="responsible_id"
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        >
          <option value="">Selecione...</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <label className="text-xs text-muted">Descrição</label>
        <input
          name="description"
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </div>
      {state.error && <p className="text-sm text-brand sm:col-span-2">{state.error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function TasksList({
  tasks,
  teamMembers,
  opportunities,
  config,
}: {
  tasks: CrmTask[];
  teamMembers: TeamMemberOption[];
  opportunities: { id: string; companyName: string }[];
  config: FollowupConfig | null;
}) {
  const [configuring, setConfiguring] = useState(false);
  const [completingTask, setCompletingTask] = useState<CrmTask | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {config && (
          <button
            type="button"
            onClick={() => setConfiguring(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink transition hover:border-brand"
          >
            Configurar follow-ups
          </button>
        )}
        <NewTaskForm teamMembers={teamMembers} opportunities={opportunities} />
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          Nenhuma tarefa pendente.
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-lg border bg-surface p-3.5 text-sm ${
                isOverdue(t.due_at) ? "border-brand/40 bg-brand-soft/20" : "border-border"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {TASK_TYPE_LABELS[t.type]} — {t.companyName}
                </p>
                <p className="text-xs text-muted">
                  {formatDueAt(t.due_at)}
                  {t.responsibleName && ` · ${t.responsibleName}`}
                  {t.source === "followup" && ` · automática${t.stageName ? ` (${t.stageName})` : ""}`}
                  {isOverdue(t.due_at) && " · atrasada"}
                </p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingTask(t)}
                  className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand/90"
                >
                  Concluir
                </button>
                {t.type === "realizar_reuniao" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(() => markMeetingNotHeld(t.id))}
                    className="text-xs text-muted transition hover:text-brand"
                  >
                    Não aconteceu
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => cancelTaskAction(t.id))}
                  className="text-xs text-muted transition hover:text-brand"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {configuring && config && <FollowupRulesModal config={config} onClose={() => setConfiguring(false)} />}

      {completingTask && (
        <CompleteTaskModal
          task={completingTask}
          teamMembers={teamMembers}
          onClose={() => setCompletingTask(null)}
        />
      )}
    </div>
  );
}
