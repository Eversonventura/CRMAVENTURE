import { createBrowserClient } from "@supabase/ssr";
import { cleanWorkspaceId, WS_COOKIE, WS_HEADER } from "@/lib/workspace";

function readWorkspaceCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${WS_COOKIE}=`));
  return cleanWorkspaceId(match?.slice(WS_COOKIE.length + 1));
}

export function createClient() {
  const ws = readWorkspaceCookie();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ws ? { global: { headers: { [WS_HEADER]: ws } } } : undefined
  );
}
