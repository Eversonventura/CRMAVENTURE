// Origens (canais de aquisição) de cada conta. Conta sem origens cadastradas usa esta lista padrão.
import { ACQUISITION_CHANNELS } from "./types";

export type Channel = { name: string; isAd: boolean };

// "Tráfego pago" é a origem de anúncio padrão (alimenta "Responder leads de anúncio").
export const DEFAULT_CHANNELS: Channel[] = ACQUISITION_CHANNELS.map((name) => ({ name, isAd: name === "Tráfego pago" }));

export const adChannelNames = (channels: Channel[]) => channels.filter((c) => c.isAd).map((c) => c.name);
