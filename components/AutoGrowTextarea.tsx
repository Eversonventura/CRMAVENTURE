"use client";

import { useLayoutEffect, useRef } from "react";

// Só no módulo de Produção, por pedido do usuário: a caixa cresce com
// o texto até 10 linhas, depois disso rola normal (como já acontecia
// antes). Não se aplica a título/subtítulo — esses continuam sendo
// <input>, de 1 linha só, em vez desse componente.
const MAX_ROWS = 10;

function resize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "20") || 20;
  const maxHeight = lineHeight * MAX_ROWS;
  const next = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

export function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (ref.current) resize(ref.current);
  }, [props.value, props.defaultValue]);

  return (
    <textarea
      {...props}
      ref={ref}
      onInput={(e) => {
        resize(e.currentTarget);
        props.onInput?.(e);
      }}
    />
  );
}
