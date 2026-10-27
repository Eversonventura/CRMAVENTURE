"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Não foi possível salvar a senha. Tente novamente.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (checking) {
    return <p className="text-sm text-muted">Carregando...</p>;
  }

  if (!hasSession) {
    return (
      <div className="text-center">
        <p className="text-sm text-brand">
          Sua sessão de convite ou recuperação de senha expirou ou é
          inválida.
        </p>
        <a
          href="/login"
          className="mt-5 inline-block rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-ink"
        >
          Voltar pro login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm text-muted">
          Nova senha
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-ink placeholder:text-muted/60 outline-none transition focus:border-brand"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm_password" className="text-sm text-muted">
          Confirmar senha
        </label>
        <input
          id="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-ink placeholder:text-muted/60 outline-none transition focus:border-brand"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Definir senha e entrar"}
      </button>
    </form>
  );
}
