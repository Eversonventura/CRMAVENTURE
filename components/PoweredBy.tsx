// Rodapé fixo do sistema: crédito da Aventure.
export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex items-center justify-center gap-2 py-4 text-xs text-muted ${className}`}>
      <span>Powered by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-aventure.svg" alt="Aventure" className="h-3.5 w-auto" />
    </footer>
  );
}
