import Link from "next/link";
import type { OlympicTargets } from "../olympic";
import { olympicProgress } from "../olympic";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

// Meta olímpica do mês: dinheiro novo RECEBIDO no mês × Bronze/Prata/Ouro/RMV.
export function OlympicCard({
  month,
  monthLabel,
  isCurrentMonth,
  targets,
  newMoney,
  breakdown,
  sold,
  periodParam,
}: {
  month: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  targets: OlympicTargets;
  newMoney: number;
  breakdown: { label: string; value: number }[];
  sold: number;
  periodParam: string;
}) {
  const progress = olympicProgress(newMoney, targets);
  const scaleMax = Math.max(targets.rmv, newMoney) * 1.02;
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const reached = TIERS.filter((t) => progress.tier !== "none" && TIERS.findIndex((x) => x.key === progress.tier) >= TIERS.findIndex((x) => x.key === t.key));
  const top = reached.at(-1);
  const nextTier = progress.next ? TIERS.find((t) => t.key === progress.next!.key) : null;
  const link = (m: string) => `/crm/visao-geral?periodo=${periodParam}&mes=${m}`;

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Meta olímpica — {monthLabel}</h2>
          <p className="text-xs text-muted">Só dinheiro novo recebido no mês (regime de caixa). Mensalidade de cliente antigo não entra.</p>
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
        <p className="font-display text-3xl font-medium text-ink">{money(newMoney)}</p>
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
              · faltam {money(progress.next.remaining)} pro {nextTier.label}
            </span>
          )}
          {!progress.next && <span className="text-muted"> · RMV batido! 🎉</span>}
        </p>
      </div>

      {/* Barra com os marcos */}
      <div className="relative mt-8 mb-10 h-3 rounded-full bg-surface2">
        <div className="h-full rounded-full bg-brand/80" style={{ width: pct(newMoney) }} />
        {TIERS.map((t) => {
          const value = targets[t.key === "rmv" ? "rmv" : t.key];
          const hit = newMoney >= value;
          return (
            <div key={t.key} className="absolute top-0 -translate-x-1/2" style={{ left: pct(value) }}>
              <div className="h-3 w-0.5" style={{ backgroundColor: t.color }} />
              <div className="mt-1 text-center" style={{ minWidth: 64 }}>
                <p className={`text-[11px] font-medium ${hit ? "text-ink" : "text-muted"}`}>
                  {t.emoji} {t.label}
                </p>
                <p className="text-[10px] text-muted">{money(value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {breakdown.map((b) => (
          <div key={b.label} className="rounded-lg border border-border bg-white px-3 py-2">
            <p className="text-xs text-muted">{b.label}</p>
            <p className="font-medium text-ink">{money(b.value)}</p>
          </div>
        ))}
        <div className="rounded-lg border border-dashed border-border bg-white px-3 py-2">
          <p className="text-xs text-muted">Vendido no mês (gestão)</p>
          <p className="font-medium text-ink">{money(sold)}</p>
          <p className="text-[10px] text-muted">só entra na meta quando for recebido</p>
        </div>
      </div>
      {isCurrentMonth && <p className="mt-2 text-[11px] text-muted">Mês em andamento — o valor sobe conforme você der baixa nas parcelas em Recebimentos.</p>}
    </div>
  );
}
