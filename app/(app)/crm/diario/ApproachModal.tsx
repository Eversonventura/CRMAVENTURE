"use client";

import { useRef, useState } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import type { ApproachChannel } from "./approach-channels";
import { registerApproach } from "./actions";

const input =
  "rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

const CHANNEL_OPTIONS: [ApproachChannel, string][] = [
  ["mensagem", "Mensagem"],
  ["instagram", "Instagram"],
  ["ligacao", "Ligação"],
  ["email", "E-mail"],
  ["presencial", "Presencial"],
  ["indicacao", "Indicação"],
  ["evento", "Evento"],
];

type Mode = "lead" | "mesa" | "next";

const RESULTS = [
  { key: "sem_resposta", label: "Sem resposta ainda", hint: "Fica em Tentativa de contato (o follow-up sai pela regra)" },
  { key: "respondeu", label: "Respondeu", hint: "Vai pra Contato realizado" },
  { key: "sem_interesse", label: "Sem interesse agora", hint: "Vai pra Stand-by (aquecimento)" },
  { key: "outra", label: "Outra etapa…", hint: "Você escolhe o destino" },
] as const;

function tomorrowISO() {
  const d = new Date(Date.now() - 3 * 3600000 + 86400000);
  return d.toISOString().slice(0, 10);
}

// Registra uma abordagem: resultado (pra onde o card vai), canal e observação, e a
// PRÓXIMA APROXIMAÇÃO (data + o que fazer), que vira um follow-up futuro no Diário.
//  - lead: abordagem de um lead novo (com resultado/etapa)
//  - mesa: abordagem de uma oportunidade da mesa (sem mudar de etapa)
//  - next: só definir a próxima aproximação (nada foi feito agora)
export function ApproachModal({
  mode,
  opportunityId,
  personId,
  companyName,
  stageOptions,
  onClose,
}: {
  mode: Mode;
  opportunityId: string;
  personId: string;
  companyName: string;
  stageOptions: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [result, setResult] = useState<"sem_resposta" | "respondeu" | "sem_interesse" | "outra">("sem_resposta");
  const [stageId, setStageId] = useState("");
  const [channel, setChannel] = useState<ApproachChannel>("mensagem");
  const [note, setNote] = useState("");
  const [scheduleNext, setScheduleNext] = useState(mode !== "lead");
  const [nextDate, setNextDate] = useState(tomorrowISO());
  const [nextText, setNextText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noteScope = useRef<HTMLDivElement>(null);
  const nextScope = useRef<HTMLDivElement>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await registerApproach({
      opportunityId,
      personId,
      result: mode === "lead" ? result : undefined,
      stageId: mode === "lead" && result === "outra" ? stageId : undefined,
      channel: mode === "next" ? undefined : channel,
      note,
      next: scheduleNext && nextDate ? { date: nextDate, text: nextText } : undefined,
    });
    setBusy(false);
    if (response.error) setError(response.error);
    else onClose();
  }

  const title = mode === "next" ? "Próxima aproximação" : "Registrar abordagem";

  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{companyName}</p>

        {mode === "lead" && (
          <div className="mt-4">
            <p className="text-xs font-medium text-ink">Como foi?</p>
            <div className="mt-2 space-y-1.5">
              {RESULTS.map((r) => (
                <label
                  key={r.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    result === r.key ? "border-brand bg-brand-soft/50" : "border-border"
                  }`}
                >
                  <input type="radio" checked={result === r.key} onChange={() => setResult(r.key)} className="mt-1" />
                  <span>
                    <span className="text-ink">{r.label}</span>
                    <span className="block text-xs text-muted">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {result === "outra" && (
              <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={`${input} mt-2 w-full`} aria-label="Etapa de destino">
                <option value="">Escolha a etapa…</option>
                {stageOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {mode !== "next" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted">Canal</span>
            {CHANNEL_OPTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChannel(key)}
                className={`rounded-full border px-3 py-1 text-xs ${channel === key ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4" ref={noteScope}>
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted">{mode === "next" ? "Observação (opcional)" : "Observação — o que foi dito/feito"}</label>
            <VoiceInputButton within={noteScope} />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={900}
            placeholder="Ex.: mandei mensagem, ainda sem resposta."
            className={`${input} mt-1 w-full resize-y`}
          />
        </div>

        <div className="mt-4 rounded-lg border border-border p-3">
          {mode !== "next" && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} />
              Agendar a próxima aproximação
            </label>
          )}
          {(scheduleNext || mode === "next") && (
            <div className="mt-2 space-y-2" ref={nextScope}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Quando</span>
                <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={input} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted">O que fazer na aproximação</label>
                  <VoiceInputButton within={nextScope} />
                </div>
                <textarea
                  value={nextText}
                  onChange={(e) => setNextText(e.target.value)}
                  rows={2}
                  placeholder="Ex.: reforçar o follow-up, mandar uma postagem, enviar um informativo…"
                  className={`${input} mt-1 w-full resize-y`}
                />
              </div>
              <p className="text-[11px] text-muted">Vira um follow-up desse lead e aparece no Diário no dia.</p>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-brand">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || (mode === "lead" && result === "outra" && !stageId)}
            onClick={submit}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
