import { redirect } from "next/navigation";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import { AppHeader } from "@/components/AppHeader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = await getAccessContext();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        userName={(user.user_metadata?.full_name as string | undefined) || user.email || ""}
        workspaces={access.workspaces.map((w) => ({ id: w.id, name: w.name, role: w.role }))}
        activeId={access.workspaceId}
      />
      <main className="min-w-0 flex-1 p-5 sm:p-8">
        {access.workspaceId ? (
          children
        ) : (
          <p className="text-sm text-muted">
            Não encontramos nenhuma conta para o seu usuário. Saia e entre de novo; se persistir, confira se o
            schema do banco foi aplicado por inteiro.
          </p>
        )}
      </main>
    </div>
  );
}
