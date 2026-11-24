// Origens (canais de aquisição) de cada conta. Conta sem origens cadastradas usa esta lista padrão.
import { ACQUISITION_CHANNELS } from "./types";

export type Channel = { name: string; isAd: boolean };

// "Tráfego pago" é a origem de anúncio padrão (alimenta "Responder leads de anúncio").
// Sempre em ordem alfabética (sem diferenciar acento nem maiúscula): origem nova entra no lugar certo sozinha.
export const sortChannels = (channels: Channel[]) =>
  [...channels].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

export const DEFAULT_CHANNELS: Channel[] = sortChannels(ACQUISITION_CHANNELS.map((name) => ({ name, isAd: name === "Tráfego pago" || name === "Meta Ads" })));

export const adChannelNames = (channels: Channel[]) => channels.filter((c) => c.isAd).map((c) => c.name);
