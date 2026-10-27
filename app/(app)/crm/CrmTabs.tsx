"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/crm/diario", label: "Diário" },
  { href: "/crm/visao-geral", label: "Visão Geral" },
  { href: "/crm/funil", label: "Funil" },
  { href: "/crm/tarefas", label: "Tarefas" },
  { href: "/crm/contatos", label: "Contatos & Empresas" },
  { href: "/crm/agenda", label: "Agenda" },
  { href: "/crm/propostas", label: "Propostas" },
  { href: "/crm/recebimentos", label: "Recebimentos" },
];

export function CrmTabs() {
  const pathname = usePathname();

  return (
    <div className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1 pb-px">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
