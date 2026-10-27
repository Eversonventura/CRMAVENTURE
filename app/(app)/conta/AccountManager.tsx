"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelInvite,
  createWorkspace,
  deleteWorkspace,
  inviteMember,
  removeMember,
  renameWorkspace,
  setMemberRole,
} from "@/lib/workspace-actions";

export type Member = { id: string; profile_id: string; full_name: string; email: string | null; crm_role: Role };
export type Invite = { id: string; email: string; crm_role: Role };
type Role = "administrador" | "gestor" | "vendedor";

const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  vendedor: "Vendedor",
};
const ROLE_HINTS: Record<Role, string> = {
  administrador: "Vê tudo e configura etapas, metas, regras e recebimentos.",
  gestor: "Vê toda a carteira (leads, tarefas, Diário de todos).",
  vendedor: "Vê e trabalha só as oportunidades e tarefas em que é o responsável.",
};

const input =
  "rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";
const primary = "rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60";
const ghost = "rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand hover:text-ink disabled:opacity-60";

export function AccountManager({
  workspace,
  isAdmin,
  myMemberId,
  ownerId,
  members,
  invites,
}: {
  workspace: { id: string; name: string; isOwner: boolean };
  isAdmin: boolean;
  myMemberId: string | null;
  ownerId: string;
  members: Member[];
  invites: Invite[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [name, setName] = useState(workspace.name);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("vendedor");
  const [newWorkspace, setNewWorkspace] = useState("");

  function run(action: () => Promise<{ error?: string; message?: string }>, after?: () => void) {
    setFeedback(null);
    start(async () => {
      const result = await action();
      if (result.error) setFeedback({ kind: "error", text: result.error });
      else {
        if (result.message) setFeedback({ kind: "ok", text: result.message });
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Compartilhar conta</h1>
        <p className="mt-1.5 text-sm text-muted">
          Os dados do CRM pertencem à <strong className="text-ink">conta</strong> ativa. Convide pessoas por e-mail para
          trabalharem nela; cada uma entra com o próprio login e enxerga só o que o papel permite.
        </p>
      </div>

      {feedback && (
        <p
          role="status"
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            feedback.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-brand/30 bg-brand-soft text-brand"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-medium text-ink">Conta ativa</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 space-y-1 text-sm">
            <span className="text-xs text-muted">Nome da conta</span>
            <input value={name} disabled={!isAdmin} onChange={(e) => setName(e.target.value)} className={`${input} w-full`} />
          </label>
          {isAdmin && (
            <button
              type="button"
              disabled={pending || !name.trim() || name.trim() === workspace.name}
              onClick={() => run(() => renameWorkspace(workspace.id, name))}
              className={primary}
            >
              Renomear
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-medium text-ink">Pessoas com acesso</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-white">
          {members.map((m) => {
            const isOwner = m.profile_id === ownerId;
            const isMe = m.id === myMemberId;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {m.full_name || m.email}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-muted">(você)</span>}
                    {isOwner && <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-normal text-brand">dono</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && !isOwner ? (
                    <select
                      value={m.crm_role}
                      disabled={pending}
                      onChange={(e) => run(() => setMemberRole(m.id, e.target.value))}
                      className={input}
                    >
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-muted">{ROLE_LABELS[m.crm_role]}</span>
                  )}
                  {!isOwner && (isAdmin || isMe) && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const msg = isMe ? "Sair dessa conta? Você perde o acesso aos dados dela." : `Remover ${m.full_name || m.email} da conta?`;
                        if (confirm(msg)) run(() => removeMember(m.id, isMe));
                      }}
                      className="text-xs text-muted hover:text-brand"
                    >
                      {isMe ? "Sair da conta" : "Remover"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {isAdmin && invites.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-medium text-ink">Convites pendentes</h3>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-white">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                  <span className="text-ink">
                    {i.email} <span className="text-xs text-muted">· {ROLE_LABELS[i.crm_role]}</span>
                  </span>
                  <button type="button" disabled={pending} onClick={() => run(() => cancelInvite(i.id))} className="text-xs text-muted hover:text-brand">
                    Cancelar convite
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {isAdmin ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => inviteMember(workspace.id, email, role), () => setEmail(""));
            }}
          >
            <h3 className="text-sm font-medium text-ink">Convidar pessoa</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@da-pessoa.com"
                className={`${input} min-w-[220px] flex-1`}
              />
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={input}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={pending} className={primary}>
                Convidar
              </button>
            </div>
            <p className="text-xs text-muted">{ROLE_HINTS[role]}</p>
          </form>
        ) : (
          <p className="mt-4 text-xs text-muted">Só administradores da conta convidam ou removem pessoas.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-medium text-ink">Outra conta</h2>
        <p className="mt-1 text-xs text-muted">
          Crie uma conta separada (por exemplo, para outro negócio). Ela começa com funil, metas e regras padrão.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createWorkspace(newWorkspace), () => setNewWorkspace(""));
          }}
        >
          <input
            required
            value={newWorkspace}
            onChange={(e) => setNewWorkspace(e.target.value)}
            placeholder="Nome da nova conta"
            className={`${input} min-w-[220px] flex-1`}
          />
          <button type="submit" disabled={pending} className={ghost}>
            Criar conta
          </button>
        </form>
      </section>

      {workspace.isOwner && (
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-5">
          <h2 className="font-display text-base font-medium text-red-800">Excluir esta conta</h2>
          <p className="mt-1 text-xs text-red-800/80">
            Apaga permanentemente todos os leads, empresas, tarefas e recebimentos da conta — para todas as pessoas.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (prompt(`Para confirmar, digite o nome da conta: ${workspace.name}`) === workspace.name) {
                run(() => deleteWorkspace(workspace.id));
              }
            }}
            className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            Excluir conta
          </button>
        </section>
      )}
    </div>
  );
}
