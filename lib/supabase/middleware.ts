import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // getClaims() confere a assinatura do token localmente (sem ida à rede em
  // cada navegação); só sem sessão confirma com getUser() antes de ir ao login.
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) user = { id: data.claims.sub };
  } catch {
    user = null;
  }
  if (!user) {
    const {
      data: { user: fetched },
    } = await supabase.auth.getUser();
    user = fetched;
  }

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path === "/cadastro";
  // /auth/*: a sessão do convite/recuperação é estabelecida no cliente (o token
  // vem no fragmento da URL). /api/cron/*: valida CRON_SECRET na própria rota.
  const isPublicRoute = path.startsWith("/auth/") || path.startsWith("/api/cron/");

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
