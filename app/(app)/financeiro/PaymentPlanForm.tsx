"use client";

import { useState } from "react";
import { splitInstallments } from "./payment-plan";
import type { InstallmentInput } from "./receivables-lib";

const input =
  "rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Plano de pagamento: total, à vista ou parcelado, e cada parcela editável
// (valor, data e se já foi recebida). Vale pra projeto fechado no CRM, venda
// avulsa e comissão (1 parcela).
export function PaymentPlanForm({
  defaultTotal,
  defaultDescription,
  showDescription = true,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "Cancelar",
  showMethod = false,
  dueDay = null,
}: {
  defaultTotal: number | null;
  defaultDescription: string;
  showDescription?: boolean;
  submitLabel: string;
  onSubmit: (installments: InstallmentInput[], description: string, method: string | null) => Promise<{ error?: string }>;
  onCancel: () => void;
  cancelLabel?: string;
  // Mostra "forma de pagamento" (Pix, boleto…) — anotada na venda.
  showMethod?: boolean;
  // Dia de vencimento da mensalidade do cliente: atalho pra alinhar as parcelas.
  dueDay?: number | null;
}) {
  const [description, setDescription] = useState(defaultDescription);
  const [total, setTotal] = useState(defaultTotal ? String(defaultTotal) : "");
  const [mode, setMode] = useState<"avista" | "parcelado">("avista");
  const [count, setCount] = useState("2");
  const [firstDate, setFirstDate] = useState(todayISO());
  const [rows, setRows] = useState<InstallmentInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("");

  function regenerate(next: { total?: string; mode?: "avista" | "parcelado"; count?: string; firstDate?: string }) {
    const t = Number((next.total ?? total).replace(",", "."));
    const m = next.mode ?? mode;
    const c = m === "avista" ? 1 : Math.min(36, Math.max(2, Number(next.count ?? count) || 2));
    const d = next.firstDate ?? firstDate;
    if (!(t > 0) || !d) {
      setRows([]);
      return;
    }
    setRows(splitInstallments(t, c, d).map((p) => ({ ...p, paid: false })));
  }

  // Gera o plano inicial na primeira edição de qualquer campo; antes disso
  // calcula na hora (valor padrão já preenchido).
  const initial = rows.length === 0 && Number(total) > 0 ? splitInstallments(Number(total), 1, firstDate).map((p) => ({ ...p, paid: false })) : null;
  const list = rows.length > 0 ? rows : (initial ?? []);
  const sum = list.reduce((s, p) => s + p.amount, 0);

  // "Junto com a mensalidade": a 1ª parcela (entrada) fica como está e as demais
  // caem no dia de vencimento do cliente, nos meses seguintes.
  function alignToDueDay() {
    if (!dueDay || list.length < 2) return;
    const entry = list[0];
    const [y, m, d] = entry.dueDate.split("-").map(Number);
    // próxima ocorrência do dia depois da entrada
    let monthIndex = d < dueDay ? 0 : 1;
    const next = list.slice(1).map((r) => {
      const target = new Date(Date.UTC(y, m - 1 + monthIndex, 1));
      const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(dueDay, last));
      monthIndex += 1;
      return { ...r, dueDate: target.toISOString().slice(0, 10) };
    });
    setRows([entry, ...next]);
  }

  function updateRow(i: number, patch: Partial<InstallmentInput>) {
    setRows(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await onSubmit(list, description, method || null);
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="space-y-3 text-sm">
      {showDescription && (
        <label className="block space-y-1">
          <span className="text-xs text-muted">Descrição</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} w-full`} />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-muted">Valor total (R$)</span>
          <input
            value={total}
            inputMode="decimal"
            onChange={(e) => {
              setTotal(e.target.value);
              regenerate({ total: e.target.value });
            }}
            className={`${input} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">{mode === "avista" ? "Data do pagamento" : "1ª parcela"}</span>
          <input
            type="date"
            value={firstDate}
            onChange={(e) => {
              setFirstDate(e.target.value);
              regenerate({ firstDate: e.target.value });
            }}
            className={`${input} w-full`}
          />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "avista"}
            onChange={() => {
              setMode("avista");
              regenerate({ mode: "avista" });
            }}
          />
          À vista
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "parcelado"}
            onChange={() => {
              setMode("parcelado");
              regenerate({ mode: "parcelado" });
            }}
          />
          Parcelado em
        </label>
        {mode === "parcelado" && (
          <input
            type="number"
            min={2}
            max={36}
            value={count}
            onChange={(e) => {
              setCount(e.target.value);
              regenerate({ count: e.target.value });
            }}
            className={`${input} w-16`}
          />
        )}
        {mode === "parcelado" && <span className="text-xs text-muted">parcelas mensais — edite valor e data de cada uma abaixo</span>}
      </div>

      {showMethod && (
        <label className="block space-y-1">
          <span className="text-xs text-muted">Forma de pagamento</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${input} w-full`}>
            <option value="">—</option>
            <option value="Pix">Pix</option>
            <option value="Boleto">Boleto</option>
            <option value="Cartão">Cartão</option>
            <option value="Outra">Outra</option>
          </select>
        </label>
      )}

      {list.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 border-b border-border bg-surface2 px-3 py-1.5 text-xs text-muted">
            <span>#</span>
            <span>Valor (R$)</span>
            <span>Vencimento</span>
            <span>Já recebida?</span>
          </div>
          {list.map((p, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2 px-3 py-1.5">
              <span className="text-muted">{i + 1}</span>
              <input
                value={String(p.amount)}
                inputMode="decimal"
                onChange={(e) => updateRow(i, { amount: Number(e.target.value.replace(",", ".")) || 0 })}
                className={`${input} w-full`}
              />
              <input type="date" value={p.dueDate} onChange={(e) => updateRow(i, { dueDate: e.target.value })} className={`${input} w-full`} />
              <input type="checkbox" checked={p.paid} onChange={(e) => updateRow(i, { paid: e.target.checked })} aria-label="Já recebida" />
            </div>
          ))}
          {dueDay && list.length > 1 && (
            <div className="border-t border-border px-3 py-1.5">
              <button type="button" onClick={alignToDueDay} className="text-xs text-brand underline hover:opacity-80">
                Alinhar parcelas com a mensalidade (dia {dueDay}) — a 1ª fica como entrada
              </button>
            </div>
          )}
          <div className="flex justify-between border-t border-border px-3 py-1.5 text-xs">
            <span className="text-muted">Total das parcelas</span>
            <span className="font-medium text-ink">{brl(sum)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-brand">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-ink">
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy || list.length === 0}
          onClick={submit}
          className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Salvando..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
