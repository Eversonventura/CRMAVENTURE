"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_MODEL_LABELS, SEGMENTS, type BusinessModel, type SalesMode } from "../business";
import { GoalsForm } from "../GoalsForm";
import type { SalesGoalMap } from "../sales-goals";
import type { OlympicSettings } from "../olympic";
import { saveBusinessProfile, saveCadence } from "./actions";
import { FollowupRulesSection, type FollowupConfig } from "./FollowupRulesSection";
import { OlympicSettingsForm } from "./OlympicSettingsForm";

const field = "rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const primary = "rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60";

function Section({ id, title, hint, children }: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Feedback({ msg }: { msg: { kind: "ok" | "error"; text: string } | null }) {
  if (!msg) return null;
  return <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-brand"}`}>{msg.text}</span>;
}

function BusinessProfile({ model: initialModel, segment: initialSegment }: { model: BusinessModel; segment: string | null }) {
  const router = useRouter();
  const [model, setModel] = useState<BusinessModel>(initialModel);
  const [segment, setSegment] = useState<string>(initialSegment ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveBusinessProfile(model, segment || null);
      setMsg(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "Perfil do negócio salvo." });
      if (!result.error) router.refresh();
    } catch {
      setMsg({ kind: "error", text: "Não foi possível salvar agora. Verifique a conexão e tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">Modelo comercial</p>
      <div className="mt-2 grid max-w-xl grid-cols-2 gap-2 text-sm">
        {(Object.keys(BUSINESS_MODEL_LABELS) as BusinessModel[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModel(m)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              model === m ? "border-brand bg-brand-soft text-brand" : "border-border text-ink hover:border-brand"
            }`}
          >
            <span className="block font-medium">{BUSINESS_MODEL_LABELS[m].title}</span>
            <span className="text-xs text-muted">{BUSINESS_MODEL_LABELS[m].hint}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 block max-w-xl space-y-1 text-sm">
        <span className="font-medium text-ink">Segmento do negócio</span>
        <select value={segment} onChange={(e) => setSegment(e.target.value)} className={`${field} w-full`}>
          <option value="">Selecione…</option>
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className={primary}>
          {busy ? "Salvando..." : "Salvar perfil"}
        </button>
        <Feedback msg={msg} />
      </div>
    </div>
  );
}

function Cadence({
  approaches: a0,
  weeklyApproaches: wa0,
  weekly: w0,
  weeklyAdLeads: wl0,
  dailyAdReplies: dr0,
}: {
  approaches: number;
  weeklyApproaches: number;
  weekly: number;
  weeklyAdLeads: number;
  dailyAdReplies: number;
}) {
  const router = useRouter();
  const [approaches, setApproaches] = useState(String(a0));
  const [weeklyApproaches, setWeeklyApproaches] = useState(String(wa0));
  const [weekly, setWeekly] = useState(String(w0));
  const [weeklyAdLeads, setWeeklyAdLeads] = useState(String(wl0));
  const [dailyAdReplies, setDailyAdReplies] = useState(String(dr0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveCadence({
        approaches: Number(approaches),
        weeklyApproaches: Number(weeklyApproaches),
        weeklyLeads: Number(weekly),
        weeklyAdLeads: Number(weeklyAdLeads),
        dailyAdReplies: Number(dailyAdReplies),
      });
      setMsg(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "Cadência salva." });
      if (!result.error) router.refresh();
    } catch {
      setMsg({ kind: "error", text: "Não foi possível salvar agora. Verifique a conexão e tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, hint: string, value: string, set: (v: string) => void) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-ink">
        {label}
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input type="number" min={0} value={value} onChange={(e) => set(e.target.value)} className={`${field} w-24`} />
    </label>
  );

  return (
    <div>
      <div className="max-w-xl space-y-3 text-sm">
        {row("Novas abordagens por dia", "Contatos ativos que cada pessoa faz por dia.", approaches, setApproaches)}
        {row("Abordagens por semana", "Meta da semana (padrão: 5 dias × a meta diária).", weeklyApproaches, setWeeklyApproaches)}
        {row("Leads novos por semana", "Para abastecer o fluxo (prospecção).", weekly, setWeekly)}
        {row("Leads de anúncio por semana", "Meta de captação por anúncios (canal Tráfego pago). 0 = sem meta.", weeklyAdLeads, setWeeklyAdLeads)}
        {row("Responder leads de anúncio por dia", "Quantos leads de anúncio responder por dia. 0 = sem meta.", dailyAdReplies, setDailyAdReplies)}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className={primary}>
          {busy ? "Salvando..." : "Salvar cadência"}
        </button>
        <Feedback msg={msg} />
      </div>
    </div>
  );
}

export function ConfigManager({
  isAdmin,
  model,
  segment,
  approaches,
  weekly,
  weeklyApproaches,
  weeklyAdLeads,
  dailyAdReplies,
  olympic,
  followups,
  salesMode,
  kpiTargets,
  members,
  memberGoals,
}: {
  isAdmin: boolean;
  model: BusinessModel;
  segment: string | null;
  approaches: number;
  weekly: number;
  weeklyApproaches: number;
  weeklyAdLeads: number;
  dailyAdReplies: number;
  olympic: OlympicSettings;
  followups: FollowupConfig;
  salesMode: SalesMode;
  kpiTargets: Record<string, number>;
  members: { id: string; name: string }[];
  memberGoals: SalesGoalMap;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Configurações</h1>
        <p className="mt-1.5 text-sm text-muted">
          {isAdmin
            ? "As mudanças valem para todo o time. O gestor altera só a cadência e os follow-ups."
            : "Como gestor, você ajusta a cadência e os follow-ups. Perfil do negócio, meta olímpica e metas do mês são só do administrador."}
        </p>
      </div>

      {isAdmin && (
      <Section
        id="perfil"
        title="Perfil do negócio"
        hint="Define quais campos aparecem ao cadastrar contatos e oportunidades."
      >
        <BusinessProfile model={model} segment={segment} />
      </Section>
      )}

      <Section
        id="cadencia"
        title="Cadência do Diário"
        hint="Quanto o time deve abordar, captar e responder por dia e por semana. Quem trabalha mais com anúncios pode reduzir as abordagens e dar meta para responder leads de anúncio."
      >
        <Cadence approaches={approaches} weeklyApproaches={weeklyApproaches} weekly={weekly} weeklyAdLeads={weeklyAdLeads} dailyAdReplies={dailyAdReplies} />
      </Section>

      {isAdmin && (
      <Section
        id="meta-olimpica"
        title="Meta olímpica"
        hint="Bronze, Prata, Ouro e RMV da Visão Geral: medidos por faturamento ou por contratos fechados."
      >
        <OlympicSettingsForm settings={olympic} />
      </Section>
      )}

      {isAdmin && (
      <Section
        id="metas"
        title="Metas do mês"
        hint={salesMode === "contratos" ? "Metas da equipe e de cada vendedor na Visão Geral. Sua conta mede vendas por contratos fechados (sem receita nem ticket médio); para voltar a medir por faturamento, mude a Meta olímpica." : "Metas da equipe e de cada vendedor na Visão Geral (fechamentos, receita, conversão, ticket médio e outras). Para medir por contratos fechados, mude a Meta olímpica."}
      >
        <GoalsForm salesMode={salesMode} targets={kpiTargets} members={members} memberGoals={memberGoals} />
      </Section>
      )}

      <Section
        id="follow-ups"
        title="Follow-ups por etapa"
        hint="Cada etapa do seu fluxo aparece aqui (etapa nova entra sozinha). Quando um card entra numa etapa, a tarefa da regra é agendada sozinha; ao sair da etapa, a tarefa automática pendente dela é cancelada. Tarefas criadas à mão nunca são mexidas. Mover o card continua manual."
      >
        <FollowupRulesSection config={followups} />
      </Section>
    </div>
  );
}
