export function NoPermission() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-2xl font-medium text-ink">Sem permissão</h1>
      <p className="mt-1.5 text-sm text-muted">
        Esta área é só do administrador da conta. Se você acha que deveria ter acesso, fale com ele.
      </p>
    </div>
  );
}
