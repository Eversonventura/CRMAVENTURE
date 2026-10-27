import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { AccountManager, type Invite, type Member } from "./AccountManager";

export default async function ContaPage() {
  const access = await getAccessContext();
  const supabase = await createClient();
  const active = access.workspaces.find((w) => w.id === access.workspaceId);
  if (!active) return null;

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, profile_id, full_name, email, crm_role, created_at")
      .eq("workspace_id", active.id)
      .order("created_at"),
    access.isFullAdmin
      ? supabase.from("workspace_invites").select("id, email, crm_role, created_at").eq("workspace_id", active.id).order("created_at")
      : Promise.resolve({ data: [] as Invite[] }),
  ]);

  return (
    <AccountManager
      workspace={{ id: active.id, name: active.name, isOwner: active.ownerId === (await currentProfileId(supabase)) }}
      isAdmin={access.isFullAdmin}
      myMemberId={access.teamMemberId}
      ownerId={active.ownerId}
      members={(members as Member[]) ?? []}
      invites={(invites as Invite[]) ?? []}
    />
  );
}

async function currentProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
