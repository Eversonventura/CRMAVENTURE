"use client";

import { useState, useTransition } from "react";
import { MESSAGE_KINDS, MESSAGE_VARIABLES, type MessageKind, type MessageTemplate } from "../messages";
import { deleteTemplate, saveTemplate, setTemplateActive } from "./actions";

const field = "w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const primary = "rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60";
const ghost = "rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand hover:text-ink disabled:opacity-60";

type Draft = { id?: string; kind: MessageKind; title: string; body: string };

function Editor({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = await saveTemplate({ id: draft.id, kind: draft.kind, title, body });
      if (result.error) setError(result.error);
      else onSaved();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand/40 bg-white p-4">
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-muted">Título (só para você achar a mensagem)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Ex.: Primeira tentativa" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-muted">Mensagem</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`${field} resize-y`} />
      </label>
      <p className="text-xs text-muted">
        Variáveis:{" "}
        {MESSAGE_VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            onClick={() => setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}${v.token}`)}
            title={v.hint}
            className="mr-2 rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-ink hover:bg-brand-soft"
          >
            {v.token}
          </button>
        ))}
        (clique para inserir)
      </p>
      {error && <p className="text-sm text-brand">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={save} className={primary}>
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className={ghost}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function MessagesManager({ templates, canEdit }: { templates: MessageTemplate[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Mensagens</h1>
        <p className="mt-1.5 text-sm text-muted">
          Modelos de mensagem que o time vê como sugestão no card do lead, prontos para copiar ou abrir no WhatsApp com os dados do
          contato já preenchidos. {canEdit ? "Você, como administrador, edita os modelos." : "Só o administrador da conta edita os modelos."}
        </p>
      </div>
      {error && <p className="rounded-lg border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-sm text-brand">{error}</p>}

      {MESSAGE_KINDS.map(({ kind, label, hint }) => {
        const list = templates.filter((t) => t.kind === kind);
        return (
          <section key={kind} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-medium text-ink">{label}</h2>
                <p className="text-xs text-muted">{hint}</p>
              </div>
              {canEdit && !editing && (
                <button type="button" onClick={() => setEditing({ kind, title: "", body: "" })} className={ghost}>
                  + Nova mensagem
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {editing && !editing.id && editing.kind === kind && (
                <Editor draft={editing} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} />
              )}
              {list.length === 0 && !(editing && !editing.id && editing.kind === kind) && (
                <p className="text-sm text-muted">Nenhuma mensagem ainda.</p>
              )}
              {list.map((t) =>
                editing?.id === t.id ? (
                  <Editor key={t.id} draft={editing} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} />
                ) : (
                  <div key={t.id} className={`rounded-lg border border-border bg-white p-3.5 ${t.active ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {t.title}
                        {!t.active && <span className="ml-2 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-normal text-muted">desativada</span>}
                      </p>
                      {canEdit && (
                        <div className="flex items-center gap-3 text-xs">
                          <button type="button" className="text-muted hover:text-brand" onClick={() => setEditing({ id: t.id, kind: t.kind, title: t.title, body: t.body })}>
                            Editar
                          </button>
                          <button type="button" disabled={pending} className="text-muted hover:text-brand" onClick={() => run(() => setTemplateActive(t.id, !t.active))}>
                            {t.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className="text-muted hover:text-brand"
                            onClick={() => {
                              if (confirm(`Excluir a mensagem "${t.title}"?`)) run(() => deleteTemplate(t.id));
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
                  </div>
                )
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
