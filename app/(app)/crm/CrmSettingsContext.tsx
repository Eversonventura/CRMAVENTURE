"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SETTINGS, type CrmSettings } from "./business";

// Perfil do negócio da conta (B2B/B2C e segmento) para os formulários e listas do CRM.
const Ctx = createContext<CrmSettings>(DEFAULT_SETTINGS);

export function CrmSettingsProvider({ settings, children }: { settings: CrmSettings; children: React.ReactNode }) {
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}

export const useCrmSettings = () => useContext(Ctx);
