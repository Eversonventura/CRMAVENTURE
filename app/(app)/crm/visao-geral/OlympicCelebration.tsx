"use client";

import { useEffect } from "react";

export type TierInfo = { key: string; label: string; emoji: string; color: string };

// O troféu do RMV é "diamante rosa": o emoji dourado é girado para o rosa.
export const RMV_FILTER = "hue-rotate(290deg) saturate(1.35) brightness(1.05)";

export function fireConfetti(color: string, big: boolean) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const palette = [color, "#FF007A", "#FFC72C", "#FFFFFF", "#6366F1", "#14B8A6"];
  const count = big ? 260 : 180;
  const parts = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = 11 + Math.random() * 11;
    return {
      x: fromLeft ? canvas.width * 0.08 : canvas.width * 0.92,
      y: canvas.height * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: palette[Math.floor(Math.random() * palette.length)],
    };
  });
  const start = performance.now();
  const DURATION = 3800;
  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    const fade = t > DURATION - 800 ? Math.max(0, (DURATION - t) / 800) : 1;
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.globalAlpha = fade;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx!.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}


// Card "Você bateu a meta!" na cor do troféu (sem valor). Fecha com botão, clique fora ou Esc.
export function CelebrationPopup({ tier, onClose }: { tier: TierInfo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={() => onClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Meta batida"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border-4 px-6 py-8 text-center shadow-2xl"
            style={{
              borderColor: tier.color,
              background:
                tier.key === "rmv"
                  ? "linear-gradient(145deg, #FFF0F8 0%, #FFB3DA 45%, #FF6FB5 100%)"
                  : `linear-gradient(145deg, #ffffff 0%, ${tier.color}55 55%, ${tier.color} 130%)`,
              boxShadow: `0 20px 60px ${tier.color}80`,
              animation: "olympic-card-in .55s cubic-bezier(.2,1.3,.4,1) both",
            }}
          >
            <style>{`@keyframes olympic-card-in { 0% { transform: scale(.7) translateY(20px); opacity: 0 } 100% { transform: scale(1) translateY(0); opacity: 1 } }`}</style>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/50"
              style={{ animation: "olympic-shine 2.4s ease-in-out .5s 2" }}
            />
            <div
              className="relative text-8xl leading-none"
              style={{
                animation: "olympic-pop .8s ease-out both, olympic-bob 2.4s ease-in-out .9s infinite",
                filter: tier.key === "rmv" ? RMV_FILTER : undefined,
              }}
            >
              {tier.emoji}
            </div>
            <h3 className="relative mt-4 font-display text-3xl font-bold leading-tight text-ink">Você bateu a meta!</h3>
            <p className="relative mt-1 text-lg font-semibold text-ink/80">Meta {tier.label}</p>
            <button
              type="button"
              onClick={() => onClose()}
              className="relative mt-6 rounded-xl bg-ink px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        </div>
  );
}
