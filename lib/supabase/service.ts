import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente com service_role: ignora RLS. Só para rotas de servidor sem sessão
// (cron de automações). NUNCA importar em componente "use client".
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
