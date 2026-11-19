import Link from "next/link";
import type { OlympicMode, OlympicTargets } from "../olympic";
import { ladderPosition, olympicProgress } from "../olympic";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const contracts = (v: number) => `${Math.round(v)} contrato${Math.round(v) === 1 ? "" : "s"}`;

const TIERS = [
  { key: "bronze", label: "Bronze", color: "#CD7F32", emoji: "🥉" },
  { key: "silver", label: "Prata", color: "#A8A9AD", emoji: "🥈" },
  { key: "gold", label: "Ouro", color: "#D4AF37", emoji: "🥇" },
  { key: "rmv", label: "RMV", color: "#FF007A", emoji: "🏆" },
] as const;

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Meta olímpica do mês: VENDAS FECHADAS no mês × Bronze/Prata/Ouro/RMV, medidas
// pelo valor vendido (R$) ou pela quantidade de contratos fechados (modo escolhido
// em Metas). Os pagamentos recebidos aparecem só como informação.
export function OlympicCard({
  month,
  monthLabel,
  isCurrentMonth,
  mode,
  targets,
  progressValue,
  breakdown,
  sales,
  received,
  periodParam,
}: {
  month: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  mode: OlympicMode;
  targets: OlympicTargets;
  progressValue: number; // R$ vendido no mês, ou nº de contratos (conforme o modo)
  breakdown: { label: string; value: number }[];
  sales: { key: string; label: string; client: string; value: number; date: string }[];
  received: number;
  periodParam: string;
}) {
  const fmt = mode === "contratos" ? contracts : money;
  const progress = olympicProgress(progressValue, targets);
  const pct = (v: number) => `${ladderPosition(v, targets)}%`;
  const reached = TIERS.filter((t) => progress.tier !== "none" && TIERS.findIndex((x) => x.key === progress.tier) >= TIERS.findIndex((x) => x.key === t.key));
  const top = reached.at(-1);
  const nextTier = progress.next ? TIERS.find((t) => t.key === progress.next!.key) : null;
  const link = (m: string) => `/crm/visao-geral?periodo=${periodParam}&mes=${m}`;

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">
            Meta olímpica — {monthLabel}
            <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 align-middle text-[11px] font-normal text-brand">
              {mode === "contratos" ? "por contratos fechados" : "por valor vendido"}
            </span>
          </h2>
          <p className="text-xs text-muted">
            Conta as VENDAS fechadas no mês, qualquer que seja a forma de pagamento (venda de agosto parcelada não entra aqui). Mensalidade
            de cliente antigo não é venda nova.
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link href={link(shiftMonth(month, -1))} className="rounded-lg border border-border px-2.5 py-1 text-muted hover:text-ink" aria-label="Mês anterior">
            ←
          </Link>
          <Link href={link(shiftMonth(month, 1))} className="rounded-lg border border-border px-2.5 py-1 text-muted hover:text-ink" aria-label="Próximo mês">
            →
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <p className="font-display text-3xl font-medium text-ink">{fmt(progressValue)}</p>
        <p className="text-sm text-ink">
          {top ? (
            <>
              {top.emoji} <strong>{top.label}</strong> batido
            </>
          ) : (
            "Ainda abaixo do Bronze"
          )}
          {nextTier && progress.next && (
            <span className="text-muted">
              {" "}
              · faltam {fmt(progress.next.remaining)} pro {nextTier.label}
            </span>
          )}
          {!progress.next && <span className="text-muted"> · parabéns! 🎉</span>}
        </p>
      </div>

      {/* Barra com os marcos */}
      <div className="relative mt-8 mb-8 h-3 rounded-full bg-surface2 sm:mb-10">
        <div className="h-full rounded-full bg-brand/80" style={{ width: pct(progressValue) }} />
        {TIERS.map((t) => {
          const value = targets[t.key];
          const hit = progressValue >= value;
          return (
            <div
              key={t.key}
              className={`absolute top-0 ${t.key === "rmv" ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: pct(value) }}
            >
              <div className={`h-3 w-0.5 ${t.key === "rmv" ? "ml-auto" : "mx-auto"}`} style={{ backgroundColor: t.color }} />
              <div className={`mt-1 ${t.key === "rmv" ? "text-right" : "text-center"}`} style={{ minWidth: 64 }}>
                <p className={`whitespace-nowrap text-[11px] font-medium ${hit ? "text-ink" : "text-muted"}`}>
                  <span className="sm:hidden">{t.emoji}</span>
                  <span className="hidden sm:inline">
                    {t.emoji} {t.label}
                  </span>
                </p>
                <p className="hidden whitespace-nowrap text-[10px] text-muted sm:block">{fmt(value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Celular: a barra é estreita, então os valores dos marcos vão numa legenda. */}
      <div className="-mt-3 mb-4 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:hidden">
        {TIERS.map((t) => (
          <p key={t.key}>
            {t.emoji} {t.label}: <span className="text-ink">{fmt(targets[t.key])}</span>
          </p>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {breakdown.map((b) => (
          <div key={b.label} className="rounded-lg border border-border bg-white px-3 py-2">
            <p className="text-xs text-muted">{b.label}</p>
            <p className="font-medium text-ink">{fmt(b.value)}</p>
          </div>
        ))}
        <div className="rounded-lg border border-dashed border-border bg-white px-3 py-2">
          <p className="text-xs text-muted">Recebido no mês (caixa)</p>
          <p className="font-medium text-ink">{money(received)}</p>
          <p className="text-[10px] text-muted">só informativo — a meta usa as vendas</p>
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-ink">Ver as {sales.length} venda(s) deste mês</summary>
        <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-white">
          {sales.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">Nenhuma venda fechada neste mês ainda.</p>
          ) : (
            sales.map((e) => (
              <div key={e.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                <span className="text-ink">
                  {e.client} <span className="text-xs text-muted">· {e.label}</span>
                </span>
                <span className="text-xs text-muted">
                  {e.date.split("-").reverse().join("/")} · <strong className="text-ink">{money(e.value)}</strong>
                </span>
              </div>
            ))
          )}
        </div>
      </details>
      {isCurrentMonth && <p className="mt-2 text-[11px] text-muted">Mês em andamento — o valor sobe a cada venda fechada (funil ou novo recebimento).</p>}
    </div>
  );
}
