"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CelebrationPopup, RMV_FILTER, fireConfetti, type TierInfo } from "./OlympicCelebration";

type Props = {
  scope: string; // conta (workspace): a comemoração é por conta, mês e marco
  month: string;
  isCurrentMonth: boolean;
  tier: TierInfo | null;
  next: { label: string; remainingLabel: string } | null;
};

// Confete em canvas (sem dependência): cai por ~3,5 s e some sozinho.
// Destaque do marco atingido na meta olímpica + comemoração (confete) uma vez
// por marco/mês neste navegador; o botão comemora de novo quando quiser.
export function OlympicBanner({ scope, month, isCurrentMonth, tier, next }: Props) {
  const [replayed, setReplayed] = useState(0);
  const [popup, setPopup] = useState(false);
  const fired = useRef(false);

  const celebrate = useCallback(
    (big: boolean) => {
      if (!tier) return;
      setPopup(true);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      fireConfetti(tier.color, big);
    },
    [tier]
  );


  useEffect(() => {
    if (!tier || !isCurrentMonth || fired.current) return;
    fired.current = true;
    const key = `olympic-celebrated:${scope}:${month}:${tier.key}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* sem localStorage: comemora mesmo assim */
    }
    const t = setTimeout(() => celebrate(tier.key === "rmv"), 400);
    return () => clearTimeout(t);
  }, [tier, scope, month, isCurrentMonth, celebrate]);

  if (!tier) return null;
  const isMax = !next;

  return (
    <div
      className="olympic-banner relative mt-4 overflow-hidden rounded-xl border-2 px-4 py-3.5 sm:px-5"
      style={{
        borderColor: tier.color,
        background: `linear-gradient(110deg, ${tier.color}26 0%, ${tier.color}0d 55%, ${tier.color}26 100%)`,
        boxShadow: `0 0 0 3px ${tier.color}22, 0 8px 28px ${tier.color}40`,
      }}
    >
      <style>{`
        @keyframes olympic-pop { 0% { transform: scale(.6) rotate(-12deg); opacity: 0 } 60% { transform: scale(1.18) rotate(6deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes olympic-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes olympic-shine { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
        @media (prefers-reduced-motion: reduce) { .olympic-banner * { animation: none !important } }
      `}</style>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/40"
        style={{ animation: "olympic-shine 3.2s ease-in-out 0.6s 2" }}
      />
      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        <span
          className="text-5xl leading-none"
          style={{
            animation: "olympic-pop .7s ease-out both, olympic-bob 2.4s ease-in-out .8s infinite",
            filter: tier.key === "rmv" ? RMV_FILTER : undefined,
          }}
        >
          {tier.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            {isMax ? `${tier.label} conquistado!` : `${tier.label} batido!`}
          </p>
          <p className="mt-0.5 text-sm text-ink/80">
            {isMax ? "Meta máxima do mês atingida. Parabéns, time!" : (
              <>
                Próximo marco: <strong>{next!.label}</strong> · faltam <strong>{next!.remainingLabel}</strong>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          key={replayed}
          onClick={() => {
            setReplayed((n) => n + 1);
            celebrate(true);
          }}
          className="rounded-lg border border-ink/20 bg-white/80 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-white"
        >
          🎉 Comemorar
        </button>
      </div>
      {popup && <CelebrationPopup tier={tier} onClose={() => setPopup(false)} />}
    </div>
  );
}
