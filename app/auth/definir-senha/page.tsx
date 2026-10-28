import { Logo } from "@/components/Logo";
import { PoweredBy } from "@/components/PoweredBy";
import { SetPasswordForm } from "./SetPasswordForm";

export default function DefinirSenhaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center font-display text-2xl font-medium text-ink">
          Defina sua senha
        </h1>
        <p className="mb-8 mt-1.5 text-center text-sm text-muted">
          Escolha uma senha para acessar o CRM.
        </p>
        <SetPasswordForm />
      </div>
      <PoweredBy className="mt-12" />
    </div>
  );
}
