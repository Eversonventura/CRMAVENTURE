import { Logo } from "@/components/Logo";
import { PoweredBy } from "@/components/PoweredBy";
import { SignUpForm } from "./SignUpForm";

export default function CadastroPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-medium text-ink">Criar conta</h1>
        <p className="mb-8 mt-1.5 text-sm text-muted">
          Você ganha um CRM só seu e pode convidar outras pessoas depois. Se alguém já te convidou, use o mesmo e-mail do convite.
        </p>
        <SignUpForm />
      </div>
      <PoweredBy className="mt-12" />
    </div>
  );
}
