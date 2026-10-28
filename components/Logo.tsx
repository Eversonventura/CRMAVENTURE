export function Logo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo-symbol.svg"
        alt="avantecrm"
        className={`h-7 w-7 ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="avantecrm"
      className={`h-6 w-auto ${className}`}
    />
  );
}
