"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/access";
import { createServiceClient } from "@/lib/supabase/service";
import { sendCrmEmail } from "@/app/(app)/crm/email";
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

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? (host ? `${proto}://${host}` : "");
}

export async function inviteMember(workspaceId: string, email: string, role: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_to_workspace", { p_ws: workspaceId, p_email: email, p_role: role });
  if (error) return fail(error);
  refresh();

  const to = email.trim().toLowerCase();
  const origin = await siteOrigin();
  const { data: ws } = await supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  const workspaceName = (ws as { name: string } | null)?.name ?? "uma conta";

  if (data === "added") {
    // Já tinha login: entra na conta na hora. Avisa por e-mail se o envio (Resend) estiver configurado.
    if (process.env.RESEND_API_KEY) {
      await sendCrmEmail(
        [to],
        `Você foi adicionado(a) à conta ${workspaceName}`,
        `Você agora participa da conta "${workspaceName}" no avantecrm.\n\nEntre com o seu login e escolha a conta no seletor do menu lateral:\n${origin}/login\n`
      );
      return { message: "Pronto! Essa pessoa já tinha login e agora participa da conta. Enviamos um aviso por e-mail." };
    }
    return {
      message:
        "Pronto! Essa pessoa já tinha login e agora participa da conta. Nenhum e-mail foi enviado: peça para ela entrar e escolher a conta no seletor do menu lateral.",
    };
  }

  // Ainda não tem login: o Supabase manda o e-mail de convite com o link para definir a senha.
  // Ao criar o usuário, o gatilho handle_new_user já coloca a pessoa nesta conta.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { message: "Convite registrado, mas o envio de e-mail não está configurado. Peça para a pessoa criar o login com esse e-mail." };
  }
  const { error: mailError } = await createServiceClient().auth.admin.inviteUserByEmail(to, {
    redirectTo: `${origin}/auth/callback`,
  });
  if (mailError) {
    return {
      message: `Convite registrado, mas o e-mail não saiu (${mailError.message}). Peça para a pessoa criar o login com esse e-mail; a conta aparece sozinha.`,
    };
  }
  return { message: "Convite enviado por e-mail. A pessoa define a senha pelo link e já entra na conta." };
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

// Grava a foto do perfil (URL pública do bucket avatars, na pasta da própria
// pessoa) ou limpa, com null. A URL é conferida para não aceitar link de fora.
export async function setMyPhoto(url: string | null): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada. Entre de novo." };
  if (url !== null) {
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
    if (!url.startsWith(prefix)) return { error: "Foto inválida." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_photo", { p_url: url });
  if (error) return fail(error);
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
