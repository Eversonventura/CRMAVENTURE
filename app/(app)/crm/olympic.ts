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
  // Modo da meta: 0 = valor vendido (R$), 1 = contratos fechados (quantidade).
  "olympic_mode",
  "olympic_count_bronze",
  "olympic_count_silver",
  "olympic_count_gold",
  "olympic_count_rmv",
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
  olympic_mode: 0,
  olympic_count_bronze: 3,
  olympic_count_silver: 4,
  olympic_count_gold: 5,
  olympic_count_rmv: 10,
};

// A meta olímpica pode ser medida pelo VALOR vendido no mês (R$) ou pela
// QUANTIDADE de contratos fechados.
export type OlympicMode = "valor" | "contratos";
export const olympicMode = (s: OlympicSettings): OlympicMode => (s.olympic_mode === 1 ? "contratos" : "valor");

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

// Metas em quantidade de contratos (mesmo formato dos alvos em R$).
export function olympicCountTargets(s: OlympicSettings): OlympicTargets {
  return { base: 0, bronze: s.olympic_count_bronze, silver: s.olympic_count_silver, gold: s.olympic_count_gold, rmv: s.olympic_count_rmv };
}

// Os alvos que valem agora, conforme o modo escolhido.
export function activeOlympicTargets(s: OlympicSettings): OlympicTargets {
  return olympicMode(s) === "contratos" ? olympicCountTargets(s) : olympicTargets(s);
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
