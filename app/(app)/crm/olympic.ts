// Metas olímpicas (Bronze / Prata / Ouro) e RMV — lógica pura, testável.
//
// base corrigida = ponto de partida × (1 + inflação)
// Bronze/Prata/Ouro = base corrigida × (1 + crescimento)
// RMV = multiplicador × Ouro (padrão 2×), ou um valor fixo digitado.
export const OLYMPIC_KEYS = [
  "olympic_base",
  "olympic_inflation",
  "olympic_bronze",
  "olympic_silver",
  "olympic_gold",
  "rmv_multiplier",
  "rmv_manual",
] as const;
export type OlympicKey = (typeof OLYMPIC_KEYS)[number];
export type OlympicSettings = Record<OlympicKey, number>;

export const OLYMPIC_DEFAULTS: OlympicSettings = {
  olympic_base: 3000,
  olympic_inflation: 4.5,
  olympic_bronze: 15,
  olympic_silver: 25,
  olympic_gold: 35,
  rmv_multiplier: 2,
  rmv_manual: 0, // 0 = usa a fórmula
};

export function readOlympicSettings(goals: Record<string, number>): OlympicSettings {
  const out = { ...OLYMPIC_DEFAULTS };
  for (const k of OLYMPIC_KEYS) if (goals[k] !== undefined) out[k] = goals[k];
  return out;
}

export type OlympicTargets = { base: number; bronze: number; silver: number; gold: number; rmv: number };

export function olympicTargets(s: OlympicSettings): OlympicTargets {
  const base = s.olympic_base * (1 + s.olympic_inflation / 100);
  const gold = base * (1 + s.olympic_gold / 100);
  return {
    base,
    bronze: base * (1 + s.olympic_bronze / 100),
    silver: base * (1 + s.olympic_silver / 100),
    gold,
    rmv: s.rmv_manual > 0 ? s.rmv_manual : gold * s.rmv_multiplier,
  };
}

export type OlympicTier = "none" | "bronze" | "silver" | "gold" | "rmv";

export function olympicProgress(value: number, t: OlympicTargets) {
  const tier: OlympicTier =
    value >= t.rmv ? "rmv" : value >= t.gold ? "gold" : value >= t.silver ? "silver" : value >= t.bronze ? "bronze" : "none";
  const order: { key: Exclude<OlympicTier, "none">; target: number }[] = [
    { key: "bronze", target: t.bronze },
    { key: "silver", target: t.silver },
    { key: "gold", target: t.gold },
    { key: "rmv", target: t.rmv },
  ];
  const next = order.find((o) => value < o.target) ?? null;
  return { tier, next: next ? { key: next.key, remaining: next.target - value } : null };
}

// Posição (0–100) de um valor na barra "escada": os quatro marcos (Bronze,
// Prata, Ouro, RMV) ficam a distâncias iguais, e o valor anda linearmente
// dentro de cada degrau. Em escala proporcional, os três primeiros marcos
// (que ficam perto uns dos outros) viravam rótulos sobrepostos.
export function ladderPosition(value: number, t: OlympicTargets): number {
  const steps = [0, t.bronze, t.silver, t.gold, t.rmv];
  const size = 100 / (steps.length - 1);
  if (!(value > 0)) return 0;
  for (let i = 1; i < steps.length; i++) {
    if (value <= steps[i]) {
      const span = steps[i] - steps[i - 1];
      const frac = span > 0 ? (value - steps[i - 1]) / span : 1;
      return (i - 1 + Math.min(1, Math.max(0, frac))) * size;
    }
  }
  return 100;
}
