export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-xs text-muted ${className}`}>
      <span>powered by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-aventure.svg" alt="Aventure" className="h-3.5 w-auto" />
    </div>
  );
}
