"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import {
  createOpportunityAction,
  startCadenceAction,
  updateOpportunityAction,
  type CrmFormState,
} from "../actions";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { ACQUISITION_CHANNELS, TEMPERATURE_LABELS, type CrmStage, type TeamMemberOption } from "../types";
import type { FunilOpportunityRow } from "./FunilBoard";
import { ActivityTimeline } from "./ActivityTimeline";
import { whatsappLink, instagramLink } from "../linkUtils";

// Abre o link (WhatsApp/Instagram) numa aba nova, sem disparar o
// "dirty" do formulário nem submeter nada — só ao lado do campo,
// visível quando já existe um valor salvo pra clicar.
function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-1 inline-block text-xs text-brand hover:underline"
    >
      {label} →
    </a>
  );
}

// Só os campos de texto grandes (textarea) ganham o microfone de ditado — os campos
// de uma linha (nome, telefone, site…) ficam sem.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [voiceEligible, setVoiceEligible] = useState(false);
  useEffect(() => {
    const el = scopeRef.current?.querySelector("textarea, input");
    if (!el) return;
    setVoiceEligible(el.tagName === "TEXTAREA");
  }, []);
  return (
    <div className="space-y-1" ref={scopeRef}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-muted">{label}</label>
        {voiceEligible && <VoiceInputButton within={scopeRef} />}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand";

// Sprint 7 — o vendedor decide manualmente que o lead parou de
// responder e inicia o resgate (dias 0/2/5/10/20). O resgate por
// ausência em reunião é automático (Sprint 10, quando a reunião é
// marcada como não realizada), não precisa de botão aqui.
function StartCadenceButtons({ opportunityId }: { opportunityId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-xs text-brand">Resgate iniciado ✓</span>;
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await startCadenceAction(opportunityId, "resgate_conversa");
          setDone(true);
        })
      }
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand disabled:opacity-60"
    >
      {isPending ? "Iniciando..." : "Lead parou de responder → iniciar resgate"}
    </button>
  );
}

export function OpportunityModal({
  opportunity,
  stages,
  teamMembers,
  onClose,
}: {
  opportunity: FunilOpportunityRow | null;
  stages: CrmStage[];
  teamMembers: TeamMemberOption[];
  onClose: () => void;
}) {
  const isEdit = !!opportunity;
  const action = isEdit ? updateOpportunityAction : createOpportunityAction;
  const [state, formAction, pending] = useActionState<CrmFormState, FormData>(action, {});
  const prevPending = useRef(pending);
  const [dirty, setDirty] = useState(false);
  const [channel, setChannel] = useState(opportunity?.acquisitionChannel ?? "");
  const isReferral = channel === "Indicação passiva" || channel === "Indicação ativa";
  const isPaidTraffic = channel === "Tráfego pago";
  const isEvent = channel === "Evento";

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) onClose();
    prevPending.current = pending;
  }, [pending, state, onClose]);

  return (
    <ModalBackdrop dirty={dirty} onClose={onClose}>
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-xl border border-border bg-white shadow-xl sm:flex-row sm:overflow-hidden ${
          isEdit ? "sm:max-w-5xl" : "max-w-3xl"
        }`}
      >
        <div className="min-w-0 flex-1 p-6 sm:overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-medium text-ink">
              {isEdit ? "Editar oportunidade" : "Nova oportunidade"}
            </h2>
            {isEdit && <StartCadenceButtons opportunityId={opportunity!.id} />}
          </div>

          <form action={formAction} onChange={() => setDirty(true)} className="mt-4 space-y-6">
            {isEdit && (
              <>
                <input type="hidden" name="id" value={opportunity!.id} />
                <input type="hidden" name="company_id" value={opportunity!.companyId} />
                {opportunity!.contactId && (
                  <input type="hidden" name="contact_id" value={opportunity!.contactId} />
                )}
              </>
            )}

          <div>
            <h3 className="text-sm font-medium text-ink">Dados da empresa</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome da empresa *">
                <input
                  name="company_name"
                  required
                  defaultValue={opportunity?.companyName ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Site">
                <input name="website" defaultValue={opportunity?.website ?? ""} className={inputClass} />
              </Field>
              <Field label="Segmento">
                <input name="segment" defaultValue={opportunity?.segment ?? ""} className={inputClass} />
              </Field>
              <Field label="Cidade">
                <input name="city" defaultValue={opportunity?.city ?? ""} className={inputClass} />
              </Field>
              <Field label="Nº de funcionários">
                <input
                  name="employee_count"
                  defaultValue={opportunity?.employeeCount ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Faturamento aproximado">
                <input
                  name="approx_revenue"
                  defaultValue={opportunity?.approxRevenue ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Instagram">
                <input
                  name="instagram"
                  placeholder="@usuario"
                  defaultValue={opportunity?.instagram ?? ""}
                  className={inputClass}
                />
                {opportunity?.instagram && (
                  <QuickLink href={instagramLink(opportunity.instagram)} label="Abrir Instagram" />
                )}
              </Field>
              <Field label="CNPJ">
                <input name="cnpj" defaultValue={opportunity?.companyExtra?.cnpj ?? ""} className={inputClass} />
              </Field>
              <Field label="CEP">
                <input name="postal_code" defaultValue={opportunity?.companyExtra?.postal_code ?? ""} className={inputClass} />
              </Field>
              <Field label="Google Meu Negócio">
                <input
                  name="google_business_url"
                  placeholder="https://"
                  defaultValue={opportunity?.companyExtra?.google_business_url ?? ""}
                  className={inputClass}
                />
                {opportunity?.companyExtra?.google_business_url && (
                  <QuickLink href={opportunity.companyExtra.google_business_url} label="Abrir Google Meu Negócio" />
                )}
              </Field>
              <Field label="Outra rede social">
                <input
                  name="other_social_url"
                  placeholder="https://"
                  defaultValue={opportunity?.companyExtra?.other_social_url ?? ""}
                  className={inputClass}
                />
                {opportunity?.companyExtra?.other_social_url && (
                  <QuickLink href={opportunity.companyExtra.other_social_url} label="Abrir link" />
                )}
              </Field>
              <Field label="Link (bio/linktree)">
                <input
                  name="bio_link"
                  placeholder="https://"
                  defaultValue={opportunity?.companyExtra?.bio_link ?? ""}
                  className={inputClass}
                />
                {opportunity?.companyExtra?.bio_link && <QuickLink href={opportunity.companyExtra.bio_link} label="Abrir link" />}
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Observação interna (só a equipe vê)">
                <textarea
                  name="internal_notes"
                  rows={3}
                  defaultValue={opportunity?.companyExtra?.internal_notes ?? ""}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink">Dados do contato</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome do contato">
                <input
                  name="contact_name"
                  defaultValue={opportunity?.contactName ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Cargo">
                <input name="contact_role" defaultValue={opportunity?.contactRole ?? ""} className={inputClass} />
              </Field>
              <Field label="Telefone">
                <input
                  name="contact_phone"
                  defaultValue={opportunity?.contactPhone ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  name="contact_whatsapp"
                  defaultValue={opportunity?.contactWhatsapp ?? ""}
                  className={inputClass}
                />
                {(opportunity?.contactWhatsapp || opportunity?.contactPhone) && (
                  <QuickLink
                    href={whatsappLink((opportunity.contactWhatsapp ?? opportunity.contactPhone) as string)}
                    label="Abrir conversa"
                  />
                )}
              </Field>
              <Field label="E-mail">
                <input
                  name="contact_email"
                  type="email"
                  defaultValue={opportunity?.contactEmail ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Preferência de contato">
                <input
                  name="contact_preference"
                  defaultValue={opportunity?.contactPreference ?? ""}
                  className={inputClass}
                  placeholder="WhatsApp, e-mail..."
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink">Dados comerciais</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Serviço de interesse">
                <input
                  name="service_interest"
                  defaultValue={opportunity?.serviceInterest ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Valor estimado (R$)">
                <input
                  name="estimated_value"
                  type="number"
                  step="0.01"
                  defaultValue={opportunity?.estimatedValue ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Probabilidade (%)">
                <input name="close_probability" defaultValue={opportunity?.details?.close_probability ?? ""} type="number" min="0" max="100" className={inputClass} />
              </Field>
              <Field label="Previsão de fechamento">
                <input
                  name="expected_close_date"
                  type="date"
                  defaultValue={opportunity?.expectedCloseDate ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Responsável">
                <select
                  name="responsible_id"
                  defaultValue={opportunity?.responsibleId ?? ""}
                  className={inputClass}
                >
                  <option value="">Selecione...</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Etapa">
                <select name="stage_id" defaultValue={opportunity?.stageId ?? stages[0]?.id} className={inputClass}>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Temperatura">
                <select name="temperature" defaultValue={opportunity?.temperature ?? ""} className={inputClass}>
                  <option value="">Selecione...</option>
                  {Object.entries(TEMPERATURE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select name="priority" defaultValue="" className={inputClass}>
                  <option value="">Selecione...</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </Field>
              <Field label="Motivo da busca">
                <input name="search_reason" defaultValue={opportunity?.details?.search_reason ?? ""} className={inputClass} />
              </Field>
              <Field label="Principal problema">
                <input name="main_problem" defaultValue={opportunity?.details?.main_problem ?? ""} className={inputClass} />
              </Field>
              <Field label="Objetivo desejado">
                <input name="desired_objective" defaultValue={opportunity?.details?.desired_objective ?? ""} className={inputClass} />
              </Field>
              <Field label="Orçamento disponível">
                <input name="available_budget" defaultValue={opportunity?.details?.available_budget ?? ""} className={inputClass} />
              </Field>
              <Field label="Quem decide">
                <input name="decision_maker" defaultValue={opportunity?.details?.decision_maker ?? ""} className={inputClass} />
              </Field>
              <Field label="Prazo pra começar">
                <input name="start_deadline" defaultValue={opportunity?.details?.start_deadline ?? ""} className={inputClass} />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink">Origem</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Canal de aquisição">
                <select
                  name="acquisition_channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione...</option>
                  {ACQUISITION_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {isEvent && (
              <div className="mt-3 rounded-lg border border-dashed border-border p-3">
                <Field label="Qual evento? *">
                  <input
                    name="event_name"
                    required
                    defaultValue={opportunity?.eventName ?? ""}
                    placeholder="Ex.: Feira de Negócios 2026"
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {isReferral && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
                <Field label="Quem indicou">
                  <input name="referred_by" defaultValue={opportunity?.details?.referred_by ?? ""} className={inputClass} />
                </Field>
                <Field label="Cliente/parceiro relacionado">
                  <input name="referral_related_client" defaultValue={opportunity?.details?.referral_related_client ?? ""} className={inputClass} />
                </Field>
                <Field label="Tipo">
                  <input name="referral_type" defaultValue={opportunity?.details?.referral_type ?? ""} className={inputClass} />
                </Field>
                <Field label="Data">
                  <input name="referral_date" defaultValue={opportunity?.details?.referral_date ?? ""} type="date" className={inputClass} />
                </Field>
                <Field label="Resultado gerado">
                  <input name="referral_result" defaultValue={opportunity?.details?.referral_result ?? ""} className={inputClass} />
                </Field>
              </div>
            )}

            {isPaidTraffic && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
                <Field label="Plataforma">
                  <input name="ad_platform" defaultValue={opportunity?.details?.ad_platform ?? ""} placeholder="Meta Ads, Google Ads..." className={inputClass} />
                </Field>
                <Field label="Campanha">
                  <input name="campaign" defaultValue={opportunity?.details?.campaign ?? ""} className={inputClass} />
                </Field>
                <Field label="Conjunto de anúncios">
                  <input name="ad_set" defaultValue={opportunity?.details?.ad_set ?? ""} className={inputClass} />
                </Field>
                <Field label="Anúncio">
                  <input name="ad" defaultValue={opportunity?.details?.ad ?? ""} className={inputClass} />
                </Field>
                <Field label="Palavra-chave">
                  <input name="keyword" defaultValue={opportunity?.details?.keyword ?? ""} className={inputClass} />
                </Field>
                <Field label="Página de entrada">
                  <input name="landing_page" defaultValue={opportunity?.details?.landing_page ?? ""} className={inputClass} />
                </Field>
                <Field label="Formulário">
                  <input name="form_name" defaultValue={opportunity?.details?.form_name ?? ""} className={inputClass} />
                </Field>
              </div>
            )}
          </div>

          {state.error && <p className="text-sm text-brand">{state.error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
        </div>

        {/* Painel lateral de comentários/atividade — igual ao pedido
            do usuário, no mesmo espírito do que já existe em Demandas
            (Kanban): comentários de texto e anexo de foto/arquivo,
            tudo salvo à parte do formulário principal (não depende de
            clicar "Salvar"). Só existe pra oportunidade já criada. */}
        {isEdit && (
          <div className="w-full shrink-0 border-t border-border bg-surface p-5 sm:w-96 sm:overflow-y-auto sm:border-l sm:border-t-0">
            <ActivityTimeline opportunityId={opportunity!.id} />
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
}
