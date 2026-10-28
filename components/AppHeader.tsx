"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { switchWorkspace } from "@/lib/workspace-actions";

type WorkspaceOption = { id: string; name: string; role: string };

export function AppHeader({
  userName,
  workspaces,
  activeId,
}: {
  userName: string;
  workspaces: WorkspaceOption[];
  activeId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur sm:px-8">
      <div className="flex items-center gap-4">
        <Link href="/crm/diario" aria-label="avantecrm">
          <Logo className="h-5" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {workspaces.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">Conta</span>
            <select
              value={activeId ?? ""}
              disabled={pending}
              onChange={(e) => change(e.target.value)}
              className="max-w-[220px] rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Link
          href="/conta"
          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
            pathname.startsWith("/conta") ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-brand hover:text-ink"
          }`}
        >
          Compartilhar conta
        </Link>
        <span className="hidden text-sm text-muted md:inline">{userName}</span>
        <SignOutButton />
      </div>
      {error && <p className="w-full text-sm text-brand">{error}</p>}
    </header>
  );
}
