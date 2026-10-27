"use client";

import { useState } from "react";
import { TASK_TYPE_LABELS, type TaskType } from "../types";

type AgendaTask = {
  id: string;
  type: string;
  dueAt: string;
  status: string;
  companyName: string;
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MEETING_TYPES = ["agendar_reuniao", "realizar_reuniao"];

export function AgendaView({ allTasks }: { allTasks: AgendaTask[] }) {
  // Padrão: só reuniões (a agenda de verdade). "Todas" inclui os follow-ups e
  // demais tarefas do funil, em cor mais discreta.
  const [showAll, setShowAll] = useState(false);
  const tasks = showAll ? allTasks : allTasks.filter((t) => MEETING_TYPES.includes(t.type));
  const [cursor, setCursor] = useState(() => new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDate = new Map<string, AgendaTask[]>();
  for (const t of tasks) {
    const key = toDateKey(new Date(t.dueAt));
    const list = tasksByDate.get(key) ?? [];
    list.push(t);
    tasksByDate.set(key, list);
  }

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:text-ink"
          >
            ←
          </button>
          <p className="font-display text-base capitalize text-ink">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:text-ink"
          >
            →
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Mostrar todas as tarefas
        </label>
        <button
          type="button"
          disabled
          title="Disponível assim que a integração com Google Agenda estiver ativada"
          className="cursor-not-allowed rounded-lg border border-border px-3.5 py-2 text-sm text-muted opacity-50"
        >
          Sincronizar com Google Agenda
        </button>
      </div>

      <div className="overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-1 pb-1 text-center text-xs text-muted">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const key = toDateKey(date);
          const dayTasks = tasksByDate.get(key) ?? [];
          const isToday = key === toDateKey(new Date());
          return (
            <div
              key={i}
              className={`min-h-[90px] rounded-lg border p-1.5 ${
                isToday ? "border-brand bg-brand-soft/30" : "border-border bg-surface"
              }`}
            >
              <p className="text-xs text-muted">{date.getDate()}</p>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <p
                    key={t.id}
                    title={`${t.companyName} · ${TASK_TYPE_LABELS[t.type as TaskType] ?? t.type}`}
                    className={`truncate rounded px-1 py-0.5 text-[10px] font-medium text-white ${
                      t.status === "concluida" ? "bg-muted" : MEETING_TYPES.includes(t.type) ? "bg-brand" : "bg-brand/60"
                    }`}
                  >
                    {new Date(t.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                    {t.companyName}
                  </p>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] text-muted">+{dayTasks.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
