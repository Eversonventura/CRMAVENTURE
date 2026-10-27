import type { MouseEvent, ReactNode } from "react";

// Skill de Design — Aventure Hub: mapa de cor fixo pra status em todo
// o sistema (Financeiro, Cronogramas, Demandas, CRM, Serviços
// Pontuais). Não decidir cor por tela — usar sempre este mapa.
export type StatusTone = "green" | "yellow" | "red" | "gray";

const TONE_CLASSES: Record<StatusTone, string> = {
  green: "bg-green-500/10 text-green-700",
  yellow: "bg-accent/10 text-amber-700",
  red: "bg-red-500/10 text-red-700",
  gray: "bg-surface2 text-muted",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  green: "bg-green-500",
  yellow: "bg-accent",
  red: "bg-red-500",
  gray: "bg-muted",
};

export function StatusPill({
  label,
  tone,
  className = "",
  onClick,
  disabled,
  title,
  after,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  /** Conteúdo extra dentro do pill, depois do rótulo (ex: um botão de desfazer). */
  after?: ReactNode;
}) {
  const classes = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition ${TONE_CLASSES[tone]} ${
    onClick ? "cursor-pointer hover:opacity-75 active:scale-95 disabled:opacity-50" : ""
  } ${className}`;
  const dot = <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} title={title} className={classes}>
        {dot}
        {label}
        {after}
      </button>
    );
  }

  return (
    <span className={classes} title={title}>
      {dot}
      {label}
      {after}
    </span>
  );
}
