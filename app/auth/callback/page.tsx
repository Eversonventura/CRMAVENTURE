"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { PoweredBy } from "@/components/PoweredBy";

function parseHashParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return Object.fromEntries(new URLSearchParams(hash));
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      const hashParams = parseHashParams();

      if (hashParams.error) {
        setError(
          hashParams.error_code === "otp_expired"
            ? "Este link expirou ou já foi usado. Solicite um novo link de recuperação de senha na tela de login."
            : (hashParams.error_description?.replace(/\+/g, " ") ??
                "Não foi possível validar o link.")
        );
        return;
      }

      // Fluxo implícito (access_token/refresh_token no hash — usado por
      // convites/recuperação de senha do Supabase Auth).
      if (hashParams.access_token && hashParams.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: hashParams.access_token,
          refresh_token: hashParams.refresh_token,
        });
        if (sessionError) {
          setError("Não foi possível validar o link. Peça um novo.");
          return;
        }
        router.replace("/auth/definir-senha");
        return;
      }

      // Fluxo PKCE (?code=... na query) — fallback pra outros tipos de link.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("Não foi possível validar o link. Peça um novo.");
          return;
        }
        router.replace("/auth/definir-senha");
        return;
      }

      setError("Link inválido.");
    }

    run();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mb-8">
        <Logo />
      </div>
      {error ? (
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-brand">{error}</p>
          <a
            href="/login"
            className="mt-5 inline-block rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-ink"
          >
            Voltar pro login
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted">Validando link...</p>
      )}
      <PoweredBy className="mt-12" />
    </div>
  );
}
