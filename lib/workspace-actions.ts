"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/access";
import { cleanWorkspaceId, WS_COOKIE } from "@/lib/workspace";

type Result = { error?: string; message?: string };

async function setActiveCookie(id: string) {
  const store = await cookies();
  store.set(WS_COOKIE, id, {
    path: "/",
    httpOnly: false, // o cliente do navegador também envia o header da conta
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function refresh() {
  revalidatePath("/", "layout");
}

// Mensagens de erro das RPCs já vêm em português (raise exception).
function fail(error: { message: string }): Result {
  return { error: error.message };
}

export async function switchWorkspace(id: string): Promise<Result> {
  const wanted = cleanWorkspaceId(id);
  if (!wanted) return { error: "Conta inválida." };
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada. Entre de novo." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("profile_id", user.id)
    .eq("workspace_id", wanted)
    .maybeSingle();
  if (!data) return { error: "Você não participa dessa conta." };

  await setActiveCookie(wanted);
  refresh();
  return {};
}

export async function createWorkspace(name: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", { p_name: name });
  if (error) return fail(error);
  await setActiveCookie(data as string);
  refresh();
  return {};
}

export async function renameWorkspace(id: string, name: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_workspace", { p_ws: id, p_name: name });
  if (error) return fail(error);
  refresh();
  return {};
}

export async function deleteWorkspace(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_workspace", { p_ws: id });
  if (error) return fail(error);
  const store = await cookies();
  store.delete(WS_COOKIE); // volta para a primeira conta da pessoa
  refresh();
  return {};
}

export async function inviteMember(workspaceId: string, email: string, role: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_to_workspace", { p_ws: workspaceId, p_email: email, p_role: role });
  if (error) return fail(error);
  refresh();
  return {
    message:
      data === "added"
        ? "Pronto! Essa pessoa já tem login e agora participa da conta."
        : "Convite registrado. Quando a pessoa criar o login com esse e-mail, a conta aparece para ela automaticamente.",
  };
}

export async function cancelInvite(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invite", { p_invite_id: id });
  if (error) return fail(error);
  refresh();
  return {};
}

export async function setMemberRole(memberId: string, role: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_member_id: memberId, p_role: role });
  if (error) return fail(error);
  refresh();
  return {};
}

export async function removeMember(memberId: string, leaving = false): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
  if (error) return fail(error);
  if (leaving) {
    const store = await cookies();
    store.delete(WS_COOKIE);
  }
  refresh();
  return {};
}

export async function updateMyName(name: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", { p_full_name: name });
  if (error) return fail(error);
  refresh();
  return {};
}
