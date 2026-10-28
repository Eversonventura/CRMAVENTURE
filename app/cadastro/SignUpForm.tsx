"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const field =
  "w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-ink placeholder:text-muted/60 outline-none transition focus:border-brand";

export function SignUpForm() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already")
          ? "Esse e-mail já tem cadastro. Entre com a sua senha."
          : `Não foi possível criar a conta: ${signUpError.message}`
      );
      return;
    }
    // Com confirmação de e-mail ligada no Supabase, ainda não há sessão.
    if (!data.session) {
      setConfirmSent(true);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (confirmSent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">
          Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, é só entrar.
        </p>
        <Link href="/login" className="inline-block rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-ink">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="full_name" className="text-sm text-muted">Seu nome</label>
        <input id="full_name" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm text-muted">E-mail</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm text-muted">Senha (mín. 8 caracteres)</label>
        <input id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition hover:bg-brand/90 disabled:opacity-60">
        {loading ? "Criando..." : "Criar conta"}
      </button>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
