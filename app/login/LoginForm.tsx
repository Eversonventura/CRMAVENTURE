"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Não foi possível entrar: ${error.message}`
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // O link de recuperação do Supabase cai em /auth/callback -> /auth/definir-senha.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);
    // Não revela se o e-mail existe ou não na base — mesma mensagem nos
    // dois casos, pra não virar um jeito de descobrir quem tem conta.
    if (error) {
      setError("Não foi possível enviar o link. Tente novamente.");
      return;
    }
    setResetSent(true);
  }

  if (mode === "reset") {
    return (
      <div className="space-y-5">
        {resetSent ? (
          <p className="text-sm text-ink">
            Se esse e-mail estiver cadastrado, você vai receber um link pra
            definir uma senha nova. Confira também a caixa de spam.
          </p>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="reset_email" className="text-sm text-muted">
                E-mail
              </label>
              <input
                id="reset_email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
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
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setResetSent(false);
          }}
          className="block text-center text-sm text-muted transition hover:text-brand"
        >
          Voltar pro login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          className="w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-ink placeholder:text-muted/60 outline-none transition focus:border-brand"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm text-muted">
            Senha
          </label>
          <button
            type="button"
            onClick={() => {
              setMode("reset");
              setError(null);
            }}
            className="text-xs text-muted transition hover:text-brand"
          >
            Esqueci minha senha
          </button>
        </div>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-brand hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </form>
  );
}
