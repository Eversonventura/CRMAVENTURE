"use client";

import { useState } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { PaymentPlanForm } from "../../financeiro/PaymentPlanForm";
import { ReceivablePayControl } from "./ReceivablePayControl";
import { createStandaloneReceivable, deleteSale, unmarkReceivablePaid } from "../../financeiro/receivables-actions";
import type { ReceivableRow } from "../../financeiro/types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
const todayISO = () => new Date().toISOString().slice(0, 10);

function NewReceivableModal({
  clients,
  onClose,
}: {
  clients: { id: string; company_name: string }[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"projeto" | "comissao">("projeto");
  const [clientId, setClientId] = useState("");
  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">Novo recebimento</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["projeto", "Venda de projeto / serviço", "serviço extra para um cliente atual"],
              ["comissao", "Comissão de fornecedor", "dinheiro novo de comissão"],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              className={`rounded-lg border px-3 py-2 text-left ${kind === key ? "border-brand bg-brand-soft text-brand" : "border-border text-ink hover:border-brand"}`}
            >
              <span className="block font-medium">{label}</span>
              <span className="text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>
        {kind === "projeto" && (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-xs text-muted">Cliente</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3">
          <PaymentPlanForm
            key={kind}
            defaultTotal={null}
            defaultDescription={kind === "comissao" ? "Comissão — " : "Venda — "}
            submitLabel="Salvar"
            onCancel={onClose}
            onSubmit={async (installments, description) => {
              const result = await createStandaloneReceivable({
                kind,
                clientId: kind === "projeto" ? clientId || null : null,
                description,
                installments,
              });
              if (!result.error) onClose();
              return result;
            }}
          />
        </div>
      </div>
    </ModalBackdrop>
  );
}

// "A receber": parcelas de vendas (projetos) e comissões. Cada valor conta no
// mês em que é RECEBIDO (regime de caixa). "Vendido" = soma das vendas
// lançadas no mês; "Recebido" = o que já caiu no caixa nele.
export function ReceivablesBlock({
  receivables,
  month,
  clients,
}: {
  receivables: ReceivableRow[];
  month: string;
  clients: { id: string; company_name: string }[];
}) {
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const received = receivables.filter((r) => r.status === "paid" && r.paid_at?.slice(0, 7) === month);
  const receivedTotal = received.reduce((s, r) => s + r.amount, 0);
  const pending = receivables.filter((r) => r.status === "pending");
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
  const dueThisMonth = pending.filter((r) => r.due_date.slice(0, 7) === month).reduce((s, r) => s + r.amount, 0);
  const overdue = pending.filter((r) => r.due_date < today);

  // Mostra o que está pendente + o que foi recebido no mês, agrupado por venda.
  const visible = receivables.filter((r) => r.status === "pending" || r.paid_at?.slice(0, 7) === month);
  const sales = new Map<string, ReceivableRow[]>();
  for (const r of visible) sales.set(r.sale_id, [...(sales.get(r.sale_id) ?? []), r]);
  const ordered = Array.from(sales.values()).sort(
    (a, b) => (a.find((x) => x.status === "pending")?.due_date ?? "9999").localeCompare(b.find((x) => x.status === "pending")?.due_date ?? "9999")
  );

  async function run(id: string, action: () => Promise<{ error?: string }>) {
    setBusyId(id);
    setError(null);
    const result = await action();
    setBusyId(null);
    if (result.error) setError(result.error);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-medium text-ink">Recebimentos — vendas e comissões</h2>
          <p className="text-xs text-muted">Conta no mês em que o dinheiro entra (regime de caixa).</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand/90">
          + Novo recebimento
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Recebido no mês", brl(receivedTotal), "text-emerald-700"],
          ["Previsto no mês", brl(dueThisMonth), "text-ink"],
          ["Total a receber", brl(pendingTotal), "text-ink"],
          ["Atrasado", `${overdue.length} · ${brl(overdue.reduce((s, r) => s + r.amount, 0))}`, overdue.length ? "text-red-700" : "text-ink"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg border border-border bg-white px-3 py-2">
            <p className="text-xs text-muted">{label}</p>
            <p className={`font-display text-base ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-brand">{error}</p>}

      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhuma venda a receber. Feche um negócio no Funil ou use &quot;Novo recebimento&quot;.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {ordered.map((parcels) => {
            const first = parcels[0];
            return (
              <div key={first.sale_id} className="rounded-lg border border-border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2">
                  <p className="text-sm font-medium text-ink">
                    {first.description}
                    {first.companyName && <span className="font-normal text-muted"> · {first.companyName}</span>}
                    <span className="ml-2 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-normal text-muted">
                      {first.kind === "comissao" ? "comissão" : first.kind === "primeira_mensalidade" ? "1ª mensalidade" : "projeto"} · {brl(first.sale_total)}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Excluir essa venda e todas as parcelas dela?")) run(first.sale_id, () => deleteSale(first.sale_id));
                    }}
                    className="text-xs text-muted hover:text-brand"
                  >
                    Excluir
                  </button>
                </div>
                {parcels
                  .sort((a, b) => a.installment_number - b.installment_number)
                  .map((r) => {
                    const late = r.status === "pending" && r.due_date < today;
                    return (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-sm">
                        <span className="text-ink">
                          Parcela {r.installment_number}/{r.installments_total} · {brl(r.amount)}
                        </span>
                        <span className={`text-xs ${late ? "text-red-700" : "text-muted"}`}>
                          {r.status === "paid" ? `recebida em ${fmt(r.paid_at!)}` : `vence ${fmt(r.due_date)}${late ? " (atrasada)" : ""}`}
                        </span>
                        {r.status === "pending" ? (
                          <ReceivablePayControl id={r.id} />
                        ) : (
                          <button type="button" disabled={busyId === r.id} onClick={() => run(r.id, () => unmarkReceivablePaid(r.id))} className="text-xs text-muted hover:text-brand">
                            Desfazer
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      {creating && <NewReceivableModal clients={clients} onClose={() => setCreating(false)} />}
    </div>
  );
}
