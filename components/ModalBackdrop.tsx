"use client";

import { useState } from "react";

// Fecha ao clicar fora do modal — mas se o formulário tiver alterações
// não salvas (`dirty`), pede confirmação antes de descartar em vez de
// fechar direto.
export function ModalBackdrop({
  dirty,
  onClose,
  children,
  className = "bg-ink/30 p-4",
}: {
  dirty: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (dirty) setConfirming(true);
    else onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${className}`}
      onClick={handleBackdropClick}
    >
      {children}

      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirming(false);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-xl">
            <h3 className="font-display text-base font-medium text-ink">
              Descartar alterações?
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              Você fez mudanças que ainda não foram salvas. Se sair agora,
              elas serão perdidas.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted transition hover:text-ink"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
