import { Logo } from "@/components/Logo";
import { PoweredBy } from "@/components/PoweredBy";
import { GrowthLine } from "@/components/GrowthLine";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-surface p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,0,122,0.10),transparent_45%)]" />
        <Logo />
        <div className="relative flex flex-1 items-center">
          <GrowthLine />
        </div>
        <p className="relative max-w-sm font-display text-2xl leading-snug text-ink">
          Prospecção, funil e metas em <span className="text-brand">um só lugar.</span>
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-2xl font-medium text-ink">Entrar no CRM</h1>
          <p className="mb-8 mt-1.5 text-sm text-muted">Use o e-mail e a senha da sua conta.</p>
          <LoginForm />
        </div>
        <PoweredBy className="mt-12" />
      </div>
    </div>
  );
}
