import { redirect } from "next/navigation";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { PoweredBy } from "@/components/PoweredBy";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = await getAccessContext();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, photo_url").eq("id", user.id).maybeSingle();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        userName={profile?.full_name || (user.user_metadata?.full_name as string | undefined) || user.email || ""}
        userPhoto={profile?.photo_url ?? null}
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
      <PoweredBy className="border-t border-border" />
    </div>
  );
}
