"use client";

import { useState } from "react";
import { CelebrationPopup, fireConfetti, type TierInfo } from "./OlympicCelebration";

// Caixa de um marco batido: clicar revê o card de comemoração (com confete) daquele marco.
export function OlympicTierButton({ tier, children, style }: { tier: TierInfo; children: React.ReactNode; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) fireConfetti(tier.color, tier.key === "rmv");
        }}
        title={`Rever a comemoração do ${tier.label}`}
        className="olympic-tier-hit cursor-pointer rounded-xl border-2 px-3 py-2.5 text-left transition hover:brightness-95"
        style={style}
      >
        {children}
      </button>
      {open && <CelebrationPopup tier={tier} onClose={() => setOpen(false)} />}
    </>
  );
}
