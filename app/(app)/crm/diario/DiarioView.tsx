"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { addManualActivity, cancelTaskAction } from "../actions";
import { CompleteTaskModal } from "../tarefas/TasksList";
import { classifyGoal, GOAL_TONE_CLASSES } from "../goals";
import { whatsappLink } from "../linkUtils";
import { ApproachModal } from "./ApproachModal";
import { OpportunityModal } from "../funil/OpportunityModal";
import type { FunilOpportunityRow } from "../funil/FunilBoard";
import { clearOffDay, markLeadChecked, getOpportunityForModal, saveDailyGoals, setOffDays, swapPick } from "./actions";
import { STAGE_ROLE_LABELS, TASK_TYPE_LABELS, type CrmStage, type CrmTask, type StageRole, type TeamMemberOption } from "../types";

export type DiarioTask = CrmTask & {
  whatsapp: string | null;
  stageRole: string | null;
  temperature: string | null;
  value: number | null;
  overdueDays: number;
};

export type DiarioData = {
  personId: string;
  people: { id: string; name: string }[];
  date: string;
  weekend: boolean;
  offToday: boolean;
  offDays: { date: string; reason: string | null }[];
  enrich: {
    total: number;
    items: { opportunityId: string; companyName: string; contactName: string | null; missingRequired: string[]; missingOptional: string[] }[];
  } | null;
  canEditGoals: boolean;
  sales: {
    monthLabel: string;
    closings: number;
    revenue: number;
    goalClosings: { target: number; personal: boolean } | null;
    goalRevenue: { target: number; personal: boolean } | null;
  };
  approach: {
    goal: number;
    done: number;
    picks: {
      opportunityId: string;
      companyName: string;
      contactName: string | null;
      whatsapp: string | null;
      instagram: string | null;
      temperature: string | null;
      approached: boolean;
      stageName: string | null;
    }[];
  };
  overdue: DiarioTask[];
  followupColumns: { role: string; goal: number | null; done: number; tasks: DiarioTask[] }[];
  prepTasks: DiarioTask[];
  mesa: {
    opportunityId: string;
    companyName: string;
    stageName: string;
    stageColor: string;
    value: number | null;
    temperature: string | null;
    nextType: string | null;
    nextDueAt: string | null;
    nextText: string | null;
    whatsapp: string | null;
  }[];
  closed: {
    opportunityId: string;
    companyName: string;
    won: boolean;
    value: number | null;
    lossReason: string | null;
    lossDetails: string | null;
    whatsapp: string | null;
  }[];
  supply: {
    weeklyBase: number;
    weeklyGoal: number;
    workdaysThisWeek: number;
    added: number;
    stock: number;
    perDay: number;
    stockDays: number;
    nextWeekNeed: number;
    nextWeekWorkdays: number;
    shortage: number;
  };
  stageOptions: { id: string; name: string }[];
  goalEditors: { stages: { stageId: string; name: string; goal: number | null }[]; weeklyLeads: number };
};

const card = "rounded-xl border border-border bg-surface p-4";
const TEMP_LABEL: Record<string, string> = { quente: "🔥 quente", morno: "morno", frio: "frio" };

function money(v: number | null) {
  return v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dueLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Progress({ done, goal }: { done: number; goal: number }) {
  const tone = GOAL_TONE_CLASSES[classifyGoal(done, goal)];
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-surface2">
        <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone.chip}`}>
        {done}/{goal}
        {done > goal ? ` (+${done - goal})` : ""}
      </span>
    </div>
  );
}

// Vendas do mês da pessoa: fechamentos e receita x meta (pessoal ou, sem ela, da equipe).
function SalesCard({ sales }: { sales: DiarioData["sales"] }) {
  const items = [
    { label: "Fechamentos", text: String(sales.closings), value: sales.closings, goal: sales.goalClosings, goalText: (n: number) => String(Math.round(n)) },
    { label: "Receita fechada", text: money(sales.revenue), value: sales.revenue, goal: sales.goalRevenue, goalText: (n: number) => money(n) },
  ];
  return (
    <section className={card}>
      <SectionTitle hint="Negócios que chegaram a Fechado neste mês, contra a meta. Meta pessoal quando existe; senão, a da equipe.">
        Vendas no mês · <span className="capitalize">{sales.monthLabel}</span>
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => {
          const tone = it.goal ? GOAL_TONE_CLASSES[classifyGoal(it.value, it.goal.target)] : null;
          const pct = it.goal && it.goal.target > 0 ? Math.min(100, Math.round((it.value / it.goal.target) * 100)) : 0;
          return (
            <div key={it.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted">{it.label}</span>
                {it.goal ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone!.chip}`}>
                    {it.goal.target > 0 ? `${Math.round((it.value / it.goal.target) * 100)}%` : "—"}
                  </span>
                ) : (
                  <span className="text-xs text-muted">sem meta</span>
                )}
              </div>
              <p className="font-display text-xl text-ink">
                {it.text}
                {it.goal && (
                  <span className="text-sm font-normal text-muted">
                    {" "}
                    / {it.goalText(it.goal.target)}
                    {!it.goal.personal && " (equipe)"}
                  </span>
                )}
              </p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface2">
                {tone && <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Nome do cliente clicável (abre o card do lead) + atalho do WhatsApp.
function ClientName({ id, name, onOpen, className }: { id: string; name: string; onOpen: (id: string) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      title="Abrir o card do cliente"
      className={`text-left hover:text-brand hover:underline ${className ?? ""}`}
    >
      {name}
    </button>
  );
}

function WhatsappLink({ number }: { number: string | null }) {
  if (!number) return <span className="text-xs text-muted opacity-60" title="Sem WhatsApp/telefone — abra o card pra preencher">sem WhatsApp</span>;
  return (
    <a href={whatsappLink(number)} target="_blank" rel="noreferrer" className="text-xs text-brand hover:opacity-80">
      WhatsApp
    </a>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-medium text-ink">{children}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onOpen,
  extra,
}: {
  task: DiarioTask;
  onComplete: (t: DiarioTask) => void;
  onOpen: (opportunityId: string) => void;
  extra?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">
          <ClientName id={task.opportunity_id} name={task.companyName} onOpen={onOpen} />{" "}
          <span className="font-normal text-muted">· {TASK_TYPE_LABELS[task.type]}</span>
        </p>
        <p className="text-xs text-muted">
          {dueLabel(task.due_at)}
          {task.overdueDays > 0 && ` · ${task.overdueDays} dia(s) de atraso`}
          {task.stageName && ` · ${task.stageName}`}
          {task.temperature && ` · ${TEMP_LABEL[task.temperature] ?? task.temperature}`}
          {!task.responsible_id && " · sem responsável"}
          {extra && ` · ${extra}`}
        </p>
        {task.description && <p className="truncate text-xs text-muted">{task.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <WhatsappLink number={task.whatsapp} />
        <button
          type="button"
          onClick={() => onComplete(task)}
          className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand/90"
        >
          Concluir
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => cancelTaskAction(task.id))}
          className="text-xs text-muted hover:text-brand"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function GoalsModal({ data, onClose }: { data: DiarioData; onClose: () => void }) {
  const [approaches, setApproaches] = useState(String(data.approach.goal));
  const [weekly, setWeekly] = useState(String(data.goalEditors.weeklyLeads));
  const [stageGoals, setStageGoals] = useState<Record<string, string>>(
    Object.fromEntries(data.goalEditors.stages.map((s) => [s.stageId, s.goal === null ? "" : String(s.goal)]))
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveDailyGoals(
      Number(approaches),
      data.goalEditors.stages.map((s) => ({
        stageId: s.stageId,
        goal: stageGoals[s.stageId] === "" ? null : Number(stageGoals[s.stageId]),
      })),
      Number(weekly)
    );
    setBusy(false);
    if (result.error) setError(result.error);
    else onClose();
  }

  const input = "w-20 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand";
  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">Metas do dia</h2>
        <p className="mt-1 text-xs text-muted">
          Mude conforme a estratégia do momento (ex.: menos abordagens, mais follow-ups). Vale pra todo o time.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink">Novas abordagens por dia</span>
            <input type="number" min={0} value={approaches} onChange={(e) => setApproaches(e.target.value)} className={input} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink">Leads novos por semana</span>
            <input type="number" min={0} value={weekly} onChange={(e) => setWeekly(e.target.value)} className={input} />
          </label>
          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted">Follow-ups por dia</p>
          {data.goalEditors.stages.map((s) => (
            <label key={s.stageId} className="flex items-center justify-between gap-3">
              <span className="text-ink">{s.name}</span>
              <input
                type="number"
                min={0}
                placeholder="—"
                value={stageGoals[s.stageId]}
                onChange={(e) => setStageGoals({ ...stageGoals, [s.stageId]: e.target.value })}
                className={input}
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-brand">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function formatOffDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

// "Sem prospecção": marca hoje (ou dias futuros) como dia sem prospecção.
function OffDaysControl({ data }: { data: DiarioData }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(data.date);
  const [to, setTo] = useState(data.date);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function rangeDates() {
    const out: string[] = [];
    const start = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to < from ? from : to}T12:00:00Z`);
    for (let d = start; d <= end && out.length < 31; d = new Date(d.getTime() + 86400000)) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10)); // fim de semana já é folga
    }
    return out;
  }

  async function mark(dates: string[]) {
    if (dates.length === 0) {
      setMessage("Só há fim de semana nesse intervalo — já é dia sem prospecção.");
      return;
    }
    setBusy(true);
    const result = await setOffDays(data.personId, dates, reason || null);
    setBusy(false);
    setMessage(
      result.error ??
        `${dates.length} dia(s) marcado(s). ${result.moved ? `${result.moved} tarefa(s) reagendada(s) pro próximo dia útil.` : "Nenhuma tarefa precisou ser reagendada."}`
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {!data.weekend && !data.offToday && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Marcar HOJE como dia sem prospecção? Os follow-ups de hoje serão reagendados pro próximo dia útil (reuniões não mudam).")) {
                mark([data.date]);
              }
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink hover:border-brand"
          >
            Sem prospecção hoje
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          Dias sem prospecção{data.offDays.length > 0 ? ` (${data.offDays.length})` : ""}
        </button>
      </div>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-border bg-white p-4 shadow-lg">
          <p className="text-sm font-medium text-ink">Marcar dias sem prospecção</p>
          <p className="mt-0.5 text-xs text-muted">
            Evento de cliente, imprevisto… Nesses dias não há abordagens nem meta, e os follow-ups vão pro próximo dia
            útil. Reuniões não mudam.
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <input type="date" min={data.date} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className="rounded-lg border border-border bg-surface2 px-2 py-1 text-sm" />
            <span className="text-muted">até</span>
            <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-surface2 px-2 py-1 text-sm" />
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="mt-2 w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => mark(rangeDates())}
            className="mt-3 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Marcando..." : "Marcar"}
          </button>
          {message && <p className="mt-2 text-xs text-muted">{message}</p>}
          {data.offDays.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Marcados</p>
              <ul className="mt-1 space-y-1 text-sm">
                {data.offDays.map((o) => (
                  <li key={o.date} className="flex items-center justify-between gap-2">
                    <span className="text-ink">
                      {formatOffDate(o.date)}
                      {o.reason && <span className="text-muted"> · {o.reason}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(true);
                        await clearOffDay(data.personId, o.date);
                        setBusy(false);
                      }}
                      className="text-xs text-muted hover:text-brand"
                    >
                      Desfazer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClosedNote({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const noteScopeRef = useRef<HTMLDivElement>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted underline hover:text-ink">
        {saved ? "Observação salva · adicionar outra" : "Adicionar observação"}
      </button>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2" ref={noteScopeRef}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        placeholder="Observação…"
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
      />
      <VoiceInputButton within={noteScopeRef} />
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            await addManualActivity(opportunityId, "anotacao", text.trim());
            setText("");
            setSaved(true);
            setOpen(false);
          })
        }
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        Salvar
      </button>
    </div>
  );
}

export function DiarioView({ data, teamMembers }: { data: DiarioData; teamMembers: TeamMemberOption[] }) {
  const router = useRouter();
  const [completing, setCompleting] = useState<DiarioTask | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [approachModal, setApproachModal] = useState<{ mode: "lead" | "mesa" | "next"; opportunityId: string; companyName: string } | null>(null);
  const [openedCard, setOpenedCard] = useState<{ opportunity: FunilOpportunityRow; stages: CrmStage[] } | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  // Abre o mesmo card do Funil (editar telefone, e-mail, nome, etc.).
  async function openCard(opportunityId: string) {
    setLoadingCard(true);
    setError(null);
    const result = await getOpportunityForModal(opportunityId);
    setLoadingCard(false);
    if (result.error || !result.opportunity || !result.stages) {
      setError(result.error ?? "Não deu pra abrir o card.");
      return;
    }
    const member = teamMembers.find((m) => m.id === result.opportunity!.responsibleId);
    setOpenedCard({
      stages: result.stages,
      opportunity: {
        ...result.opportunity,
        responsibleName: member?.full_name ?? null,
        responsiblePhoto: member?.photo_url ?? null,
      },
    });
  }

  const { approach } = data;
  const todayLabel = new Date(`${data.date}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium capitalize text-ink">{todayLabel}</h1>
          <p className="text-xs text-muted">Seu plano de execução do dia, direto das regras do funil.</p>
        </div>
        <div className="flex items-center gap-2">
          {data.people.length > 1 && (
            <select
              value={data.personId}
              onChange={(e) => router.push(`/crm/diario?pessoa=${e.target.value}`)}
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
              aria-label="Pessoa"
            >
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <OffDaysControl data={data} />
          {data.canEditGoals && (
            <button
              type="button"
              onClick={() => setGoalsOpen(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink hover:border-brand"
            >
              Metas
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <SalesCard sales={data.sales} />

      {data.overdue.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <SectionTitle hint="Ficam aqui até concluir ou cancelar. Não contam na meta do dia.">
            Atrasadas ({data.overdue.length})
          </SectionTitle>
          <div className="space-y-2">
            {data.overdue.map((t) => (
              <TaskRow key={t.id} task={t} onComplete={setCompleting} onOpen={openCard} />
            ))}
          </div>
        </section>
      )}

      {data.weekend || data.offToday ? (
        <section className={card}>
          <SectionTitle
            hint={
              data.weekend
                ? "Prospecção é de segunda a sexta. As abordagens e as metas voltam na segunda."
                : "Hoje está marcado como dia sem prospecção: sem abordagens e sem meta. Nada acumula pra amanhã."
            }
          >
            1 · Novas abordagens
          </SectionTitle>
          <p className="text-sm text-muted">
            {data.weekend ? "Hoje é fim de semana — sem prospecção. Bom descanso! 🙂" : "Dia sem prospecção."}
          </p>
          {!data.weekend && (
            <button
              type="button"
              onClick={() => clearOffDay(data.personId, data.date)}
              className="mt-2 text-xs text-muted underline hover:text-ink"
            >
              Desfazer — voltar a prospectar hoje
            </button>
          )}
        </section>
      ) : (
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle hint={`Leads sem contato, escolhidos por prioridade (quentes e mais antigos primeiro). Estoque: ${data.supply.stock} leads (~${data.supply.stockDays} dia(s)).`}>
            1 · Novas abordagens
          </SectionTitle>
          <Progress done={approach.done} goal={approach.goal} />
        </div>
        {approach.picks.length === 0 ? (
          <p className="text-sm text-muted">Nenhum lead novo disponível pra abordar.</p>
        ) : (
          <div className="space-y-2">
            {approach.picks.map((p) => (
              <div
                key={p.opportunityId}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm ${
                  p.approached ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    <ClientName id={p.opportunityId} name={p.companyName} onOpen={openCard} />
                    {p.contactName && <span className="font-normal text-muted"> · {p.contactName}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {p.temperature ? TEMP_LABEL[p.temperature] : "sem temperatura"}
                    {p.approached && ` · abordado (${p.stageName ?? ""})`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <WhatsappLink number={p.whatsapp} />
                  {p.approached ? (
                    <span className="text-xs font-medium text-emerald-700">✓ Abordado</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setApproachModal({ mode: "lead", opportunityId: p.opportunityId, companyName: p.companyName })}
                        className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-60"
                      >
                        Abordei
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await swapPick(p.opportunityId, data.personId, data.date);
                            setError(r.error ?? null);
                          })
                        }
                        className="text-xs text-muted hover:text-brand"
                      >
                        Trocar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {data.enrich && (
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle hint="Mínimo em cada lead novo: WhatsApp e Instagram. Pesquise, abra o card e preencha; se não achou nada, marque Concluído.">
              Completar leads
            </SectionTitle>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                data.enrich.total === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {data.enrich.total === 0 ? "tudo completo" : `${data.enrich.total} incompleto(s)`}
            </span>
          </div>
          {data.enrich.items.length === 0 ? (
            <p className="text-sm text-muted">Todos os leads novos já têm WhatsApp e Instagram. 🎉</p>
          ) : (
            <div className="space-y-2">
              {data.enrich.items.map((l) => (
                <div key={l.opportunityId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      <ClientName id={l.opportunityId} name={l.companyName} onOpen={openCard} />
                      {l.contactName && <span className="font-normal text-muted"> · {l.contactName}</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {l.missingRequired.map((m) => (
                        <span key={m} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          falta {m}
                        </span>
                      ))}
                      {l.missingOptional.map((m) => (
                        <span key={m} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">
                          {m}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openCard(l.opportunityId)}
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs text-ink hover:border-brand"
                    >
                      Abrir card
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => start(async () => { const r = await markLeadChecked(l.opportunityId); setError(r.error ?? null); })}
                      className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-60"
                    >
                      Concluído
                    </button>
                  </div>
                </div>
              ))}
              {data.enrich.total > data.enrich.items.length && (
                <p className="text-xs text-muted">Mostrando os {data.enrich.items.length} mais críticos de {data.enrich.total}.</p>
              )}
            </div>
          )}
        </section>
      )}

      {(data.weekend || data.offToday) && (
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle hint="Meta semanal de leads novos e estoque pra semana que vem.">Abastecer o funil</SectionTitle>
            <Progress done={data.supply.added} goal={data.supply.weeklyGoal} />
          </div>
          <p className="text-sm text-ink">
            Leads adicionados esta semana: <strong>{data.supply.added}</strong> de {data.supply.weeklyGoal}
            {data.supply.workdaysThisWeek < 5 && (
              <span className="text-muted"> (meta de {data.supply.weeklyBase} ajustada pra {data.supply.workdaysThisWeek} dia(s) de prospecção)</span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted">
            Estoque: <strong className="text-ink">{data.supply.stock}</strong> leads sem abordar — dá pra ~{data.supply.stockDays} dia(s)
            de prospecção ({data.supply.perDay}/dia).
          </p>
          {data.supply.shortage > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-sm font-medium text-ink">
                Adicione mais {data.supply.shortage} lead(s) pra semana que vem
              </p>
              <p className="text-xs text-muted">
                Semana que vem: {data.supply.nextWeekWorkdays} dia(s) × {data.supply.perDay} = {data.supply.nextWeekNeed} abordagens.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href="/crm/contatos?importar=1" className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90">
                  Importar planilha
                </a>
                <a href="/crm/funil?novo=1" className="rounded-md border border-border px-3 py-1.5 text-xs text-ink hover:border-brand">
                  Nova oportunidade
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-emerald-700">✓ Estoque cobre a semana que vem ({data.supply.nextWeekNeed} abordagens).</p>
          )}
        </section>
      )}

      <section className={card}>
        <SectionTitle hint="Tarefas do dia geradas pelas regras de cada etapa. Quem passar da meta continua visível.">
          2 · Follow-ups por etapa
        </SectionTitle>
        {data.followupColumns.length === 0 ? (
          <p className="text-sm text-muted">Nenhum follow-up pra hoje.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.followupColumns.map((col) => (
              <div key={col.role}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{STAGE_ROLE_LABELS[col.role as StageRole] ?? col.role}</h3>
                  {col.goal !== null ? (
                    <Progress done={col.done} goal={col.goal} />
                  ) : (
                    <span className="text-xs text-muted">{col.done} feito(s) · sem meta</span>
                  )}
                </div>
                <div className="space-y-2">
                  {col.tasks.length === 0 ? (
                    <p className="text-xs text-muted">Nada pendente hoje.</p>
                  ) : (
                    col.tasks.map((t, i) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onComplete={setCompleting}
                        onOpen={openCard}
                        extra={col.goal !== null && col.done + i >= col.goal ? "além da meta" : undefined}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={card}>
        <SectionTitle hint="Diagnósticos, agendamento e realização de reuniões, propostas e outras tarefas do dia.">
          3 · Preparação e agendamentos
        </SectionTitle>
        {data.prepTasks.length === 0 ? (
          <p className="text-sm text-muted">Nada agendado pra hoje.</p>
        ) : (
          <div className="space-y-2">
            {data.prepTasks.map((t) => (
              <TaskRow key={t.id} task={t} onComplete={setCompleting} onOpen={openCard} />
            ))}
          </div>
        )}
      </section>

      <section className={card}>
        <SectionTitle hint="Oportunidades em diagnóstico, proposta e negociação.">4 · Oportunidades na mesa</SectionTitle>
        {data.mesa.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma oportunidade na mesa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-4 font-normal">Cliente</th>
                  <th className="py-2 pr-4 font-normal">Etapa</th>
                  <th className="py-2 pr-4 font-normal">Valor</th>
                  <th className="py-2 pr-4 font-normal">Próxima aproximação</th>
                  <th className="py-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {data.mesa.map((o) => (
                  <tr key={o.opportunityId} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink">
                      <ClientName id={o.opportunityId} name={o.companyName} onOpen={openCard} />
                      <span className="ml-2">
                        <WhatsappLink number={o.whatsapp} />
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.stageColor }} />
                        {o.stageName}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-ink">{money(o.value)}</td>
                    <td className="py-2 pr-4 text-muted">
                      {o.nextType && o.nextDueAt ? (
                        <button
                          type="button"
                          onClick={() => setApproachModal({ mode: "next", opportunityId: o.opportunityId, companyName: o.companyName })}
                          className="text-left hover:text-brand"
                          title="Definir outra aproximação"
                        >
                          {o.nextText ? o.nextText : (TASK_TYPE_LABELS[o.nextType as keyof typeof TASK_TYPE_LABELS] ?? o.nextType)}{" "}
                          <span className="text-xs">· {dueLabel(o.nextDueAt)}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApproachModal({ mode: "next", opportunityId: o.opportunityId, companyName: o.companyName })}
                          className="rounded-md border border-brand px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand-soft"
                        >
                          + Definir aproximação
                        </button>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setApproachModal({ mode: "mesa", opportunityId: o.opportunityId, companyName: o.companyName })}
                        className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand/90"
                      >
                        Abordei
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card}>
        <SectionTitle hint="Fechamentos e perdas de hoje, com observações e motivo.">5 · Fechados e perdidos do dia</SectionTitle>
        {data.closed.length === 0 ? (
          <p className="text-sm text-muted">Nenhum fechamento ou perda hoje.</p>
        ) : (
          <div className="space-y-2">
            {data.closed.map((o) => (
              <div key={o.opportunityId} className="rounded-lg border border-border bg-white p-2.5 text-sm">
                <p className="font-medium text-ink">
                  <span className={o.won ? "text-emerald-700" : "text-red-700"}>{o.won ? "Fechado" : "Perdido"}</span>
                  {" · "}
                  <ClientName id={o.opportunityId} name={o.companyName} onOpen={openCard} />{" "}
                  <WhatsappLink number={o.whatsapp} /> <span className="font-normal text-muted">· {money(o.value)}</span>
                </p>
                {!o.won && (o.lossReason || o.lossDetails) && (
                  <p className="text-xs text-muted">
                    Motivo: {o.lossReason ?? "—"}
                    {o.lossDetails && ` — ${o.lossDetails}`}
                  </p>
                )}
                <ClosedNote opportunityId={o.opportunityId} />
              </div>
            ))}
          </div>
        )}
      </section>

      {completing && (
        <CompleteTaskModal task={completing} teamMembers={teamMembers} onClose={() => setCompleting(null)} />
      )}
      {loadingCard && (
        <div className="fixed bottom-4 right-4 z-[70] rounded-lg bg-ink px-3.5 py-2 text-sm text-white shadow-lg">
          Abrindo card…
        </div>
      )}
      {approachModal && (
        <ApproachModal
          mode={approachModal.mode}
          opportunityId={approachModal.opportunityId}
          personId={data.personId}
          companyName={approachModal.companyName}
          stageOptions={data.stageOptions}
          onClose={() => setApproachModal(null)}
        />
      )}
      {openedCard && (
        <OpportunityModal
          opportunity={openedCard.opportunity}
          stages={openedCard.stages}
          teamMembers={teamMembers}
          onClose={() => setOpenedCard(null)}
        />
      )}
      {goalsOpen && <GoalsModal data={data} onClose={() => setGoalsOpen(false)} />}
    </div>
  );
}
