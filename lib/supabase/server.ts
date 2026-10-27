import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cleanWorkspaceId, WS_COOKIE, WS_HEADER } from "@/lib/workspace";

export async function createClient() {
  const cookieStore = await cookies();
  const ws = cleanWorkspaceId(cookieStore.get(WS_COOKIE)?.value);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Conta ativa: o RLS usa este header (e confere se a pessoa é membro).
      global: ws ? { headers: { [WS_HEADER]: ws } } : undefined,
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // chamado a partir de um Server Component — o middleware renova a sessão.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem acima
          }
        },
      },
    }
  );
}
