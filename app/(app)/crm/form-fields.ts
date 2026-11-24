// Leitura de campos de formulário que só mexe no que o formulário mostrou.
// Os formulários do CRM variam por modelo (B2B/B2C) e segmento: um campo que o
// formulário não renderiza NÃO vem no FormData, e isso não pode apagar o valor que
// já está salvo (antes, campo ausente virava null e era gravado).
// Campo presente e vazio continua significando "limpar".

type Opts = { skipEmpty?: boolean };

export function pickStrings(formData: FormData, keys: readonly string[], opts: Opts = {}): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of keys) {
    if (!formData.has(key)) continue;
    const v = ((formData.get(key) as string) ?? "").trim() || null;
    if (opts.skipEmpty && v === null) continue;
    out[key] = v;
  }
  return out;
}

export function pickNumbers(formData: FormData, keys: readonly string[], opts: Opts = {}): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const key of keys) {
    if (!formData.has(key)) continue;
    const raw = ((formData.get(key) as string) ?? "").trim();
    const v = raw ? Number(raw) : null;
    if (opts.skipEmpty && v === null) continue;
    out[key] = v;
  }
  return out;
}

// Campos da empresa e do contato (nome da coluna do banco = nome do campo do formulário,
// exceto o contato, que usa o prefixo contact_ no formulário).
export const COMPANY_KEYS = [
  "website", "segment", "city", "employee_count", "approx_revenue", "instagram",
  "cnpj", "postal_code", "google_business_url", "other_social_url", "bio_link", "internal_notes",
] as const;

export const CONTACT_FORM_TO_COLUMN = {
  contact_role: "role_title",
  contact_phone: "phone",
  contact_whatsapp: "whatsapp",
  contact_email: "email",
  contact_preference: "contact_preference",
} as const;

export function pickContactFields(formData: FormData, opts: Opts = {}): Record<string, string | null> {
  const picked = pickStrings(formData, Object.keys(CONTACT_FORM_TO_COLUMN), opts);
  const out: Record<string, string | null> = {};
  for (const [formKey, value] of Object.entries(picked)) {
    out[CONTACT_FORM_TO_COLUMN[formKey as keyof typeof CONTACT_FORM_TO_COLUMN]] = value;
  }
  return out;
}

const OPP_STRING_KEYS = [
  "service_interest", "expected_close_date", "responsible_id", "temperature", "priority", "search_reason",
  "main_problem", "desired_objective", "available_budget", "decision_maker", "start_deadline", "acquisition_channel",
] as const;
const OPP_NUMBER_KEYS = ["estimated_value", "close_probability"] as const;
// Detalhes da origem aparecem conforme o canal; ao trocar o canal, os que sumiram são limpos.
const OPP_ORIGIN_KEYS = [
  "campaign", "event_name", "ad", "form_name", "landing_page", "referred_by", "referral_related_client",
  "referral_type", "referral_date", "referral_result", "ad_platform", "ad_set", "keyword",
] as const;

export function pickOpportunityFields(formData: FormData, opts: Opts = {}) {
  const out: Record<string, string | number | null> = {
    ...pickStrings(formData, OPP_STRING_KEYS, opts),
    ...pickNumbers(formData, OPP_NUMBER_KEYS, opts),
  };
  // Data de entrada do lead (campo de data do formulário) → created_at, ao meio-dia de Brasília.
  const entry = ((formData.get("entry_date") as string | null) ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(entry)) out.created_at = `${entry}T12:00:00-03:00`;
  const clearOrigin = formData.has("acquisition_channel");
  for (const key of OPP_ORIGIN_KEYS) {
    const v = ((formData.get(key) as string | null) ?? "").trim() || null;
    if (formData.has(key)) {
      if (!(opts.skipEmpty && v === null)) out[key] = v;
    } else if (clearOrigin && !opts.skipEmpty) {
      out[key] = null;
    }
  }
  return out;
}
