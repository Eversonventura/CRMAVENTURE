"use client";

import { useState } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { PaymentPlanForm } from "../../financeiro/PaymentPlanForm";
import { defineDealPayment } from "../../financeiro/receivables-actions";
import type { InstallmentInput } from "../../financeiro/receivables-lib";

const input =
  "rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

// Aparece ao fechar uma venda (e em Propostas → Fechadas, pra quem ficou
// pendente): como esse cliente vai pagar? Recorrência alimenta a mensalidade;
// projeto vira parcelas em Recebimentos.
export function ClosedDealModal({
  opportunityId,
  companyName,
  defaultValue,
  onClose,
}: {
  opportunityId: string;
  companyName: string;
  defaultValue: number | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<"recorrencia" | "projeto">("recorrencia");
  const today = new Date().toISOString().slice(0, 10);
  const [monthly, setMonthly] = useState(defaultValue ? String(defaultValue) : "");
  const [dueDay, setDueDay] = useState(String(new Date().getDate()));
  const [startDate, setStartDate] = useState(today);
  const [firstMode, setFirstMode] = useState<"normal" | "custom">("normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveRecurring(firstInstallments?: InstallmentInput[]) {
    setBusy(true);
    setError(null);
    const result = await defineDealPayment({
      opportunityId,
      type: "recorrencia",
      description: `1ª mensalidade — ${companyName}`,
      monthly: { value: Number(monthly.replace(",", ".")), dueDay: Number(dueDay), startDate },
      firstInstallments,
    });
    setBusy(false);
    if (result.error) setError(result.error);
    else onClose();
  }

  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">Venda fechada 🎉</h2>
        <p className="mt-1 text-sm text-muted">
          {companyName} — como esse cliente vai pagar? Isso alimenta Recebimentos e as metas.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["recorrencia", "Recorrência", "mensalidade"],
              ["projeto", "Projeto", "à vista ou parcelado"],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                type === key ? "border-brand bg-brand-soft text-brand" : "border-border text-ink hover:border-brand"
              }`}
            >
              <span className="block font-medium">{label}</span>
              <span className="text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          {type === "recorrencia" ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-muted">Mensalidade (R$)</span>
                  <input value={monthly} inputMode="decimal" onChange={(e) => setMonthly(e.target.value)} className={`${input} w-full`} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted">Dia do vencimento</span>
                  <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={`${input} w-full`} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted">Início</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${input} w-full`} />
                </label>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-ink">Como será paga a 1ª mensalidade?</p>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input type="radio" checked={firstMode === "normal"} onChange={() => setFirstMode("normal")} className="mt-1" />
                  <span>
                    <span className="text-ink">Parcela única</span>
                    <span className="block text-xs text-muted">A 1ª mensalidade vira uma parcela a receber na data de início.</span>
                  </span>
                </label>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input type="radio" checked={firstMode === "custom"} onChange={() => setFirstMode("custom")} className="mt-1" />
                  <span>
                    <span className="text-ink">Personalizada (partes, datas)</span>
                    <span className="block text-xs text-muted">Ex.: 50% agora e 50% no dia 1º, com início do serviço depois. As mensalidades seguintes só começam no mês seguinte.</span>
                  </span>
                </label>
              </div>
              <p className="text-xs text-muted">
                Grava no cadastro do cliente. Nas metas, só a 1ª mensalidade conta como dinheiro novo.
              </p>
              {error && <p className="text-sm text-brand">{error}</p>}
              {firstMode === "normal" ? (
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={onClose} className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-ink">
                    Definir depois
                  </button>
                  <button type="button" disabled={busy} onClick={() => saveRecurring()} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60">
                    {busy ? "Salvando..." : "Salvar recorrência"}
                  </button>
                </div>
              ) : (
                <PaymentPlanForm
                  key={monthly}
                  defaultTotal={Number(monthly.replace(",", ".")) || null}
                  defaultDescription=""
                  showDescription={false}
                  submitLabel="Salvar recorrência"
                  cancelLabel="Definir depois"
                  onCancel={onClose}
                  onSubmit={async (installments) => {
                    await saveRecurring(installments);
                    return {};
                  }}
                />
              )}
            </div>
          ) : (
            <PaymentPlanForm
              defaultTotal={defaultValue}
              defaultDescription={`Projeto — ${companyName}`}
              submitLabel="Salvar pagamento"
              cancelLabel="Definir depois"
              onCancel={onClose}
              onSubmit={async (installments, description) => {
                const result = await defineDealPayment({ opportunityId, type: "projeto", description, installments });
                if (!result.error) onClose();
                return result;
              }}
            />
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
}
