import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TEMP_RANK: Record<string, number> = { quente: 0, morno: 1, frio: 2 };

// Seleção automática das abordagens do dia: leads ainda sem contato (etapa
// de role `lead`), do responsável ou sem responsável, quentes primeiro e
// depois os mais antigos, até a meta. Quem tem WhatsApp (ou telefone) vem
// sempre antes de quem não tem. A lista fica gravada (estável o dia todo);
// "trocar" marca o lead como dispensado e a próxima chamada repõe.
type Contact = { whatsapp: string | null; phone: string | null };
type Candidate = { temperature: string | null; created_at: string; crm_contacts: Contact | Contact[] | null };

const hasPhone = (c: Candidate) => {
  const contact = Array.isArray(c.crm_contacts) ? c.crm_contacts[0] : c.crm_contacts;
  return !!(contact?.whatsapp?.trim() || contact?.phone?.trim());
};

export function rankCandidates<T extends Candidate>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = hasPhone(a) ? 0 : 1;
    const pb = hasPhone(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ta = TEMP_RANK[a.temperature ?? ""] ?? 3;
    const tb = TEMP_RANK[b.temperature ?? ""] ?? 3;
    if (ta !== tb) return ta - tb;
    return a.created_at.localeCompare(b.created_at);
  });
}

export async function ensureDailyPicks(
  supabase: Supabase,
  personId: string,
  pickDate: string,
  target: number
) {
  const { data: existing } = await supabase
    .from("crm_daily_picks")
    .select("opportunity_id, dismissed")
    .eq("pick_date", pickDate)
    .eq("responsible_id", personId);
  const rows = existing ?? [];
  const need = target - rows.filter((r) => !r.dismissed).length;
  if (need <= 0) return;

  const taken = new Set(rows.map((r) => r.opportunity_id));
  const { data: candidates } = await supabase
    .from("crm_opportunities")
    .select("id, temperature, created_at, crm_stages!inner(role), crm_contacts(whatsapp, phone)")
    .eq("status", "aberta")
    .eq("crm_stages.role", "lead")
    .is("first_contact_at", null)
    .or(`responsible_id.eq.${personId},responsible_id.is.null`)
    .order("created_at", { ascending: true })
    .limit(300);

  const chosen = rankCandidates((candidates ?? []).filter((c) => !taken.has(c.id))).slice(0, need);
  if (chosen.length === 0) return;

  await supabase.from("crm_daily_picks").upsert(
    chosen.map((c) => ({ pick_date: pickDate, responsible_id: personId, opportunity_id: c.id })),
    { onConflict: "pick_date,responsible_id,opportunity_id", ignoreDuplicates: true }
  );
}
