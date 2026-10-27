"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { createPipeline, deletePipeline, renamePipeline } from "./stage-actions";

export type PipelineOption = { id: string; name: string };

const inputClass =
  "rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

export function PipelineManagerModal({
  pipelines,
  selectedId,
  onClose,
}: {
  pipelines: PipelineOption[];
  selectedId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result?.error) setError(result.error);
    return !result?.error;
  }

  return (
    <ModalBackdrop dirty={false} onClose={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">Pipelines</h2>
        <p className="mt-1 text-xs text-muted">
          Cada pipeline tem as próprias etapas. Um pipeline novo já nasce com Novo lead, Fechado e Perdido.
        </p>

        <div className="mt-4 space-y-2">
          {pipelines.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                defaultValue={p.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== p.name) run(() => renamePipeline(p.id, value));
                }}
                className={`${inputClass} flex-1`}
                aria-label="Nome do pipeline"
              />
              {p.id === selectedId && <span className="text-[11px] text-muted">aberto</span>}
              {confirmDelete === p.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(() => deletePipeline(p.id));
                      if (ok) {
                        setConfirmDelete(null);
                        if (p.id === selectedId) router.push("/crm/funil");
                      }
                    }}
                    className="text-xs font-medium text-brand"
                  >
                    Confirmar
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="text-xs text-muted">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(p.id)}
                  className="px-1.5 text-xs text-muted hover:text-brand"
                  aria-label="Excluir pipeline"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Novo pipeline"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await createPipeline(newName);
              setBusy(false);
              if (result.error) setError(result.error);
              else if (result.id) {
                setNewName("");
                router.push(`/crm/funil?pipeline=${result.id}`);
                onClose();
              }
            }}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            + Criar
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-brand">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-ink transition hover:border-brand"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
