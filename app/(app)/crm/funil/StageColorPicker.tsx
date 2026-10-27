"use client";

import { useState } from "react";
import { updateStageColor } from "../actions";
import { STAGE_COLOR_PRESETS } from "../types";

// Bolinha de cor + paleta ampliada + qualquer cor (seletor nativo). Mesmo
// padrão visual das colunas do Kanban; usado no cabeçalho de cada etapa do
// funil e no gerenciador de etapas.
export function StageColorPicker({
  stageId,
  color,
  size = 14,
}: {
  stageId: string;
  color: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(color);

  function apply(next: string) {
    updateStageColor(stageId, next);
    setOpen(false);
  }

  return (
    <div className="relative" data-funil-draggable>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Cor da etapa"
        className="shrink-0 rounded-full ring-1 ring-inset ring-black/10"
        style={{ backgroundColor: color, width: size, height: size }}
        aria-label="Mudar cor da etapa"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-7 z-20 rounded-lg border border-border bg-white p-2.5 shadow-lg"
            style={{ width: 196 }}
          >
            <div className="flex flex-wrap gap-1.5">
              {STAGE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => apply(preset)}
                  className={`h-6 w-6 rounded-full transition ${
                    color.toLowerCase() === preset.toLowerCase() ? "ring-2 ring-offset-2 ring-ink" : ""
                  }`}
                  style={{ backgroundColor: preset }}
                  aria-label={preset}
                />
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
              <input
                type="color"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-border bg-white p-0.5"
                aria-label="Outra cor"
              />
              <span className="text-xs text-muted">Outra cor</span>
              <button
                type="button"
                onClick={() => apply(custom)}
                className="ml-auto rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-white"
              >
                Usar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
