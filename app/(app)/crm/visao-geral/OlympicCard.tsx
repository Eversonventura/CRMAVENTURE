import Link from "next/link";
import type { OlympicMode, OlympicTargets } from "../olympic";
import { olympicProgress } from "../olympic";
import { OlympicBanner } from "./OlympicBanner";
import { OlympicTierButton } from "./OlympicTierButton";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const contracts = (v: number) => `${Math.round(v)} contrato${Math.round(v) === 1 ? "" : "s"}`;

const TIERS = [
  { key: "bronze", label: "Bronze", color: "#CD7F32", emoji: "🥉" },
  { key: "silver", label: "Prata", color: "#A8A9AD", emoji: "🥈" },
  { key: "gold", label: "Ouro", color: "#D4AF37", emoji: "🥇" },
  { key: "rmv", label: "RMV", color: "#FF6FB5", emoji: "🏆" },
] as const;

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Meta olímpica do mês: VENDAS FECHADAS no mês × Bronze/Prata/Ouro/RMV, medidas
// pelo valor vendido (R$) ou pela quantidade de contratos fechados (modo escolhido
// em Metas). Desenho do Hub (barra só com os traços dos marcos, uma caixa por
// medalha, banner e confete ao bater a meta); o modo valor/contratos é daqui.
export function OlympicCard({
  scope,
  month,
  monthLabel,
  isCurrentMonth,
  mode,
  targets,
  progressValue,
  breakdown,
  sales,
  periodParam,
}: {
  scope: string; // conta ativa (a comemoração "já vista" é guardada por conta)
  month: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  mode: OlympicMode;
  targets: OlympicTargets;
  progressValue: number; // R$ vendido no mês, ou nº de contratos (conforme o modo)
  breakdown: { label: string; value: number }[];
  sales: { key: string; label: string; client: string; value: number; date: string }[];
  periodParam: string;
}) {
  const fmt = mode === "contratos" ? contracts : money;
  const progress = olympicProgress(progressValue, targets);
  const scaleMax = Math.max(targets.rmv, progressValue, 1) * 1.02;
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
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
        {!top && (
          <p className="text-sm text-ink">
            Ainda abaixo do Bronze
            {nextTier && progress.next && (
              <span className="text-muted">
                {" "}
                · faltam {fmt(progress.next.remaining)} pro {nextTier.label}
              </span>
            )}
          </p>
        )}
      </div>

      <OlympicBanner
        scope={scope}
        month={month}
        isCurrentMonth={isCurrentMonth}
        tier={top ? { key: top.key, label: top.label, emoji: top.emoji, color: top.color } : null}
        next={nextTier && progress.next ? { label: nextTier.label, remainingLabel: fmt(progress.next.remaining) } : null}
      />

      {/* Barra: só os traços dos marcos (sem texto em cima da barra — no celular os nomes se sobrepunham) */}
      <div className="relative mt-5 h-3 rounded-full bg-surface2">
        <div
          className="h-full rounded-full"
          style={{
            width: pct(progressValue),
            background: top ? `linear-gradient(90deg, #FF007A 0%, ${top.color} 100%)` : "rgba(255,0,122,0.8)",
            boxShadow: top ? `0 0 12px ${top.color}99` : undefined,
          }}
        />
        {TIERS.map((t) => {
          const hit = progressValue >= targets[t.key];
          return (
            <span
              key={t.key}
              className={`absolute -translate-x-1/2 rounded-full ring-1 ring-white ${hit ? "top-[-6px] h-[24px] w-[5px]" : "top-[-3px] h-[18px] w-[3px]"}`}
              style={{
                left: pct(targets[t.key]),
                backgroundColor: t.color,
                boxShadow: hit ? `0 0 10px 2px ${t.color}` : undefined,
              }}
              aria-hidden
            />
          );
        })}
      </div>

      {/* Legenda dos marcos: uma caixinha por meta, sem sobreposição em qualquer largura */}
      <style>{`
        @keyframes olympic-tier-in { 0% { transform: scale(.94); opacity: .4 } 60% { transform: scale(1.04) } 100% { transform: scale(1); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .olympic-tier-hit { animation: none !important } }
      `}</style>
      <div className="mb-5 mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {TIERS.map((t) => {
          const value = targets[t.key];
          const hit = progressValue >= value;
          const content = (
            <>
              <div className="flex items-center justify-between gap-1">
                <p className={`flex items-center gap-1.5 text-sm ${hit ? "font-semibold text-ink" : "font-medium text-muted"}`}>
                  <span
                    className={hit ? "text-xl leading-none" : "text-base leading-none opacity-60"}
                    style={t.key === "rmv" ? { filter: "hue-rotate(290deg) saturate(1.35) brightness(1.05)" } : undefined}
                  >
                    {t.emoji}
                  </span>
                  {t.label}
                </p>
                {hit && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: t.color }}>
                    ✓ Batido
                  </span>
                )}
              </div>
              <p className={`mt-1 ${hit ? "text-base font-semibold text-ink" : "text-sm text-muted"}`}>{fmt(value)}</p>
              {hit ? <p className="text-[11px] text-ink/60">clique para comemorar</p> : <p className="text-[11px] text-muted">faltam {fmt(value - progressValue)}</p>}
            </>
          );
          if (!hit) {
            return (
              <div key={t.key} className="rounded-xl border-2 border-border bg-white px-3 py-2.5">
                {content}
              </div>
            );
          }
          return (
            <OlympicTierButton
              key={t.key}
              tier={{ key: t.key, label: t.label, emoji: t.emoji, color: t.color }}
              style={{
                borderColor: t.color,
                background: `linear-gradient(135deg, ${t.color}33 0%, ${t.color}0f 100%)`,
                boxShadow: `0 4px 16px ${t.color}40`,
                animation: "olympic-tier-in .6s ease-out both",
              }}
            >
              {content}
            </OlympicTierButton>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {breakdown.map((b) => (
          <div key={b.label} className="rounded-lg border border-border bg-white px-3 py-2">
            <p className="text-xs text-muted">{b.label}</p>
            <p className="font-medium text-ink">{fmt(b.value)}</p>
          </div>
        ))}
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
      {isCurrentMonth && <p className="mt-2 text-[11px] text-muted">Mês em andamento — o valor sobe a cada venda fechada no funil.</p>}
    </div>
  );
}
