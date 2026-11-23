"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  FileText,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquare,
  Settings,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";
import { switchWorkspace } from "@/lib/workspace-actions";

type WorkspaceOption = { id: string; name: string; role: string };
type NavItem = { href: string; label: string; Icon: LucideIcon; adminOnly?: boolean };

// Menu do CRM. `adminOnly`: só o administrador da conta enxerga (e acessa).
const NAV_ITEMS: NavItem[] = [
  { href: "/crm/diario", label: "Diário", Icon: CalendarCheck },
  { href: "/crm/visao-geral", label: "Visão Geral", Icon: LayoutDashboard },
  { href: "/crm/funil", label: "Fluxo", Icon: Kanban },
  { href: "/crm/tarefas", label: "Tarefas", Icon: ListChecks },
  { href: "/crm/contatos", label: "Contatos & Empresas", Icon: Users },
  { href: "/crm/agenda", label: "Agenda", Icon: CalendarDays },
  { href: "/crm/propostas", label: "Propostas", Icon: FileText },
  { href: "/crm/mensagens", label: "Mensagens", Icon: MessageSquare },
  { href: "/crm/configuracoes", label: "Configurações", Icon: Settings, adminOnly: true },
];

export function AppSidebar({
  userName,
  userPhoto,
  workspaces,
  activeId,
  isAdmin,
}: {
  userName: string;
  userPhoto: string | null;
  workspaces: WorkspaceOption[];
  activeId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(id: string) {
    setError(null);
    start(async () => {
      const result = await switchWorkspace(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-brand-soft hover:text-brand ${
      active ? "bg-brand-soft font-medium text-brand" : "text-muted"
    }`;

  return (
    <>
      {/* Barra superior: só no celular */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link href="/crm/diario" aria-label="avantecrm">
          <Logo className="h-5" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink"
        >
          <Menu size={18} />
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface p-4 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between px-1">
          <Link href="/crm/diario" onClick={() => setOpen(false)} aria-label="avantecrm">
            <Logo className="h-5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {workspaces.length > 0 && (
          <label className="mb-4 block space-y-1">
            <span className="px-1 text-[11px] uppercase tracking-wide text-muted">Conta</span>
            <select
              value={activeId ?? ""}
              disabled={pending}
              onChange={(e) => change(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {error && <span className="block text-xs text-brand">{error}</span>}
          </label>
        )}

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={linkClass(pathname === href || pathname.startsWith(`${href}/`))}
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <Link href="/conta" onClick={() => setOpen(false)} className={linkClass(pathname.startsWith("/conta"))}>
            <UserPlus size={18} className="shrink-0" />
            Compartilhar conta
          </Link>
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            title="Meu perfil"
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-brand-soft ${
              pathname.startsWith("/perfil") ? "bg-brand-soft text-brand" : "text-ink"
            }`}
          >
            <Avatar name={userName} src={userPhoto} size={30} />
            <span className="min-w-0 flex-1 truncate">{userName}</span>
          </Link>
          <div className="px-1 pt-1">
            <SignOutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
