import { createClient } from "@/lib/supabase/server";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import { ProfileManager } from "./ProfileManager";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const access = await getAccessContext();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, photo_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ProfileManager
      userId={user.id}
      email={profile?.email ?? user.email ?? ""}
      fullName={profile?.full_name ?? ""}
      photoUrl={profile?.photo_url ?? null}
      activeId={access.workspaceId}
      workspaces={access.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        isOwner: w.ownerId === user.id,
      }))}
    />
  );
}
