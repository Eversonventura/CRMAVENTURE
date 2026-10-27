"use client";

import { useRef, useState, useTransition } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { markOpportunityLost } from "../actions";
import { LOSS_REASONS } from "../types";
import type { FunilOpportunityRow } from "./FunilBoard";

// Sprint 8: modal obrigatório ao mover oportunidade pra "Perdido". Se o
// motivo for "Não é o momento", oferece mandar pra nutrição com data de
// retorno em vez de simplesmente fechar como perdida.
export function LostOpportunityModal({
  opportunity,
  onClose,
  onDone,
}: {
  opportunity: FunilOpportunityRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const detailsScopeRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const isNotNow = reason === "Não é o momento";

  function handleSave(toNurturing: boolean) {
    startTransition(async () => {
      await markOpportunityLost(opportunity.id, reason, details, toNurturing, returnDate || null);
      onDone();
    });
  }

  return (
    <ModalBackdrop dirty={!!reason} onClose={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-medium text-ink">Motivo da perda</h2>
        <p className="mt-1 text-sm text-muted">{opportunity.companyName}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted">Motivo *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Selecione...</option>
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div ref={detailsScopeRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">Detalhes do motivo</label>
              <VoiceInputButton within={detailsScopeRef} />
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </div>

          {isNotNow && (
            <div className="rounded-lg border border-dashed border-brand bg-brand-soft/40 p-3">
              <label className="text-xs text-muted">Data de retorno (nutrição)</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              <p className="mt-1 text-[11px] text-muted">
                Em vez de fechar como perdida, a oportunidade fica em nutrição e volta pro
                responsável nessa data.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted transition hover:text-ink"
          >
            Cancelar
          </button>
          {isNotNow && returnDate ? (
            <button
              type="button"
              disabled={isPending || !reason}
              onClick={() => handleSave(true)}
              className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Mandar pra nutrição"}
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending || !reason}
              onClick={() => handleSave(false)}
              className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Confirmar perda"}
            </button>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
}
