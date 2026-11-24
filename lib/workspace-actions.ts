"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import { createServiceClient } from "@/lib/supabase/service";
import { sendCrmEmail } from "@/app/(app)/crm/email";
import { cleanWorkspaceId, WS_COOKIE } from "@/lib/workspace";

type Result = { error?: string; message?: string; link?: string };

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

type LinkType = "invite" | "recovery" | "magiclink";

// Gera o acesso SEM mandar e-mail. O link aponta para o próprio CRM com o token (token_hash) e só
// valida quando a pessoa abre a página: assim a prévia do WhatsApp ou o antivírus do e-mail não
// "gastam" o link antes dela (o link direto do Supabase é de uso único e expira rápido).
async function buildAccessLink(email: string, origin: string, types: LinkType[]): Promise<{ link?: string; error?: string }> {
  const admin = createServiceClient().auth.admin;
  let lastError: string | undefined;
  for (const type of types) {
    const res = await admin.generateLink({ type, email, options: { redirectTo: `${origin}/auth/callback` } });
    const hashed = res.data?.properties?.hashed_token;
    if (hashed) return { link: `${origin}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=${type}` };
    lastError = res.error?.message ?? lastError;
  }
  return { error: lastError };
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

  // O e-mail não saiu (ex.: SMTP do Supabase com problema ou no limite). Gera o link de acesso para você
  // copiar e mandar por WhatsApp. Se o usuário já foi criado pela tentativa acima, usa o link de recuperação.
  const { link, error: linkError } = await buildAccessLink(to, origin, ["invite", "recovery", "magiclink"]);
  if (link) {
    return {
      message: "O e-mail não saiu, mas o acesso está pronto. Copie o link abaixo e envie para a pessoa (WhatsApp, por exemplo). Ela define a senha e já entra na conta.",
      link,
    };
  }
  return {
    message: `Convite registrado, mas o e-mail não saiu (${mailError.message}) e o link de acesso também não pôde ser gerado (${linkError ?? "sem detalhe"}). Peça para a pessoa criar o login com esse e-mail; a conta aparece sozinha.`,
  };
}

// Novo link de acesso para quem foi convidado e ainda NÃO entrou (o anterior expirou ou foi gasto).
// Só vale para quem nunca fez login: assim um administrador não consegue entrar como outra pessoa.
export async function generateAccessLink(memberId: string): Promise<Result> {
  const access = await getAccessContext();
  if (!access.isFullAdmin) return { error: "Só o administrador gera links de acesso." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Geração de link não configurada (falta a chave de serviço)." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("profile_id, email")
    .eq("id", memberId)
    .eq("workspace_id", access.workspaceId ?? "")
    .maybeSingle();
  const m = member as { profile_id: string; email: string | null } | null;
  if (!m?.email) return { error: "Pessoa não encontrada nesta conta." };

  const { data: u } = await createServiceClient().auth.admin.getUserById(m.profile_id);
  if (!u?.user) return { error: "Login dessa pessoa não encontrado." };
  if (u.user.last_sign_in_at) {
    return { error: "Essa pessoa já acessou o sistema. Para recuperar a senha, ela usa \"Esqueci minha senha\" na tela de login." };
  }

  const { link, error } = await buildAccessLink(m.email.toLowerCase(), await siteOrigin(), ["recovery", "magiclink", "invite"]);
  if (!link) return { error: `Não foi possível gerar o link (${error ?? "sem detalhe"}).` };
  return { message: "Novo link de acesso gerado. Copie e envie para a pessoa; ela define a senha e entra.", link };
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
