// Campos de qualificação e origem do card (sem "use client": usado pelo servidor).
export type OpportunityDetails = {
  close_probability: number | null;
  search_reason: string | null;
  main_problem: string | null;
  desired_objective: string | null;
  available_budget: string | null;
  decision_maker: string | null;
  start_deadline: string | null;
  referred_by: string | null;
  referral_related_client: string | null;
  referral_type: string | null;
  referral_date: string | null;
  referral_result: string | null;
  ad_platform: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad: string | null;
  keyword: string | null;
  landing_page: string | null;
  form_name: string | null;
};

export const DETAIL_COLUMNS = "close_probability, search_reason, main_problem, desired_objective, available_budget, decision_maker, start_deadline, referred_by, referral_related_client, referral_type, referral_date, referral_result, ad_platform, campaign, ad_set, ad, keyword, landing_page, form_name";

export function readDetails(o: Record<string, unknown>): OpportunityDetails {
  const pick = (k: string) => (o[k] ?? null) as never;
  return {
    close_probability: pick("close_probability"),
    search_reason: pick("search_reason"),
    main_problem: pick("main_problem"),
    desired_objective: pick("desired_objective"),
    available_budget: pick("available_budget"),
    decision_maker: pick("decision_maker"),
    start_deadline: pick("start_deadline"),
    referred_by: pick("referred_by"),
    referral_related_client: pick("referral_related_client"),
    referral_type: pick("referral_type"),
    referral_date: pick("referral_date"),
    referral_result: pick("referral_result"),
    ad_platform: pick("ad_platform"),
    campaign: pick("campaign"),
    ad_set: pick("ad_set"),
    ad: pick("ad"),
    keyword: pick("keyword"),
    landing_page: pick("landing_page"),
    form_name: pick("form_name"),
  };
}


// Demais dados cadastrados da EMPRESA (os mesmos de Contatos & Empresas) — o card
// do lead no Funil/Diário precisa mostrá-los e preservá-los ao salvar.
export type CompanyExtra = {
  cnpj: string | null;
  postal_code: string | null;
  google_business_url: string | null;
  other_social_url: string | null;
  bio_link: string | null;
  internal_notes: string | null;
};

export function readCompanyExtra(company: Record<string, unknown> | null | undefined): CompanyExtra {
  const pick = (k: string) => ((company?.[k] ?? null) as string | null);
  return {
    cnpj: pick("cnpj"),
    postal_code: pick("postal_code"),
    google_business_url: pick("google_business_url"),
    other_social_url: pick("other_social_url"),
    bio_link: pick("bio_link"),
    internal_notes: pick("internal_notes"),
  };
}
