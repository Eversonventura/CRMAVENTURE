"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import { createServiceClient } from "@/lib/supabase/service";
import { sendCrmEmail } from "@/app/(app)/crm/email";

type Result = { error?: string; message?: string; credentials?: { email: string; password: string; loginUrl: string } };

function refresh() {
  revalidatePath("/", "layout");
}

// Mensagens de erro das RPCs já vêm em português (raise exception).
function fail(error: { message: string }): Result {
  return { error: error.message };
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
  refresh();
  return {};
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? (host ? `${proto}://${host}` : "");
}

// Senha temporária legível (sem caracteres ambíguos como 0/O e 1/l).
function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Cria (ou, se a pessoa nunca entrou, redefine) o acesso com uma senha temporária, SEM e-mail e SEM link:
// funciona mesmo sem SMTP e não expira. Só para quem ainda não fez login, para que um administrador
// nunca consiga assumir o acesso de outra pessoa. O gatilho handle_new_user já coloca a pessoa na conta.
async function provisionTempAccess(email: string): Promise<{ password?: string; error?: string }> {
  const svc = createServiceClient();
  const password = tempPassword();
  const { data: prof } = await svc.from("profiles").select("id").eq("email", email).maybeSingle();
  if (prof) {
    const { data: u } = await svc.auth.admin.getUserById((prof as { id: string }).id);
    if (!u?.user) return { error: "Login dessa pessoa não encontrado." };
    if (u.user.last_sign_in_at) {
      return { error: 'Essa pessoa já acessou o sistema. Para trocar a senha, ela usa "Esqueci minha senha" na tela de login.' };
    }
    const { error } = await svc.auth.admin.updateUserById(u.user.id, { password, email_confirm: true });
    return error ? { error: error.message } : { password };
  }
  const { error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  return error ? { error: error.message } : { password };
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
  const admin = createServiceClient().auth.admin;
  const redirectTo = `${origin}/auth/callback`;
  const { error: mailError } = await admin.inviteUserByEmail(to, { redirectTo });
  if (!mailError) {
    return { message: "Convite enviado por e-mail. A pessoa define a senha pelo link e já entra na conta." };
  }

  // O e-mail não saiu (ex.: SMTP do Supabase com problema ou no limite). Cria o acesso com senha temporária
  // para você mandar por WhatsApp.
  const access = await provisionTempAccess(to);
  if (access.password) {
    return {
      message: "O e-mail não saiu, mas o acesso está pronto. Envie o e-mail e a senha temporária abaixo para a pessoa; ela entra pelo login e troca a senha em Perfil.",
      credentials: { email: to, password: access.password, loginUrl: `${origin}/login` },
    };
  }
  return {
    message: `Convite registrado, mas o e-mail não saiu (${mailError.message}) e o acesso com senha temporária também não pôde ser criado (${access.error ?? "sem detalhe"}). Peça para a pessoa criar o login com esse e-mail; a conta aparece sozinha.`,
  };
}

// Novo acesso (senha temporária) para quem foi convidado e ainda NÃO entrou.
export async function generateAccessLink(memberId: string): Promise<Result> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só o administrador gera acessos." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Geração de acesso não configurada (falta a chave de serviço)." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("email")
    .eq("id", memberId)
    .eq("workspace_id", access.workspaceId ?? "")
    .maybeSingle();
  const email = (member as { email: string | null } | null)?.email?.toLowerCase();
  if (!email) return { error: "Pessoa não encontrada nesta conta." };

  const result = await provisionTempAccess(email);
  if (!result.password) return { error: result.error ?? "Não foi possível gerar o acesso." };
  return {
    message: "Acesso gerado. Envie o e-mail e a senha temporária abaixo para a pessoa; ela entra pelo login e troca a senha em Perfil.",
    credentials: { email, password: result.password, loginUrl: `${await siteOrigin()}/login` },
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
