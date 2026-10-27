import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { getCrmAccessContext } from "../lib";
import { FunilBoard } from "./FunilBoard";
import { readCompanyExtra, readDetails } from "./details";
import type { CrmStage, TeamMemberOption } from "../types";

export default async function CrmFunilPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const { pipeline: pipelineParam } = await searchParams;
  const supabase = await createClient();
  await getCrmAccessContext();
  const access = await getAccessContext();

  const [{ data: pipelineRows }, { data: allStages }, { data: opportunities }, { data: history }, { data: teamMembers }] =
    await Promise.all([
      supabase.from("crm_pipelines").select("id, name").order("position"),
      supabase.from("crm_stages").select("id, name, position, color, pipeline_id, kind, role").order("position"),
      supabase
        .from("crm_opportunities")
        .select(
          "id, company_id, contact_id, stage_id, status, estimated_value, service_interest, acquisition_channel, event_name, close_probability, search_reason, main_problem, desired_objective, available_budget, decision_maker, start_deadline, referred_by, referral_related_client, referral_type, referral_date, referral_result, ad_platform, campaign, ad_set, ad, keyword, landing_page, form_name, responsible_id, temperature, expected_close_date, entered_at, created_at, crm_companies(name, website, segment, city, employee_count, approx_revenue, instagram, cnpj, postal_code, google_business_url, other_social_url, bio_link, internal_notes), crm_contacts(name, role_title, phone, whatsapp, email, contact_preference)"
        )
        .eq("status", "aberta"),
      supabase
        .from("crm_stage_history")
        .select("opportunity_id, to_stage_id, changed_at")
        .order("changed_at", { ascending: false }),
      supabase.rpc("team_member_picker_options"),
    ]);

  const pipelines = (pipelineRows as { id: string; name: string }[] | null) ?? [];
  const selectedPipeline = pipelines.find((p) => p.id === pipelineParam) ?? pipelines[0];
  const stages = ((allStages as CrmStage[] | null) ?? []).filter((s) => s.pipeline_id === selectedPipeline?.id);
  const stageIds = new Set(stages.map((s) => s.id));

  const members = (teamMembers as TeamMemberOption[] | null) ?? [];
  const memberById = new Map(members.map((m) => [m.id, m]));

  // Data em que a oportunidade entrou na etapa ATUAL — primeira
  // ocorrência (mais recente) no histórico pra cada opportunity_id.
  const lastStageChangeByOpp = new Map<string, string>();
  for (const h of history ?? []) {
    if (!lastStageChangeByOpp.has(h.opportunity_id)) {
      lastStageChangeByOpp.set(h.opportunity_id, h.changed_at);
    }
  }

  type RawOpp = {
    id: string;
    company_id: string;
    contact_id: string | null;
    stage_id: string;
    status: "aberta" | "fechada" | "perdida";
    estimated_value: number | null;
    service_interest: string | null;
    acquisition_channel: string | null;
    event_name: string | null;
    responsible_id: string | null;
    temperature: "frio" | "morno" | "quente" | null;
    expected_close_date: string | null;
    entered_at: string;
    created_at: string;
    crm_companies:
      | {
          name: string;
          website: string | null;
          segment: string | null;
          city: string | null;
          employee_count: string | null;
          approx_revenue: string | null;
          instagram: string | null;
          cnpj: string | null;
          postal_code: string | null;
          google_business_url: string | null;
          other_social_url: string | null;
          bio_link: string | null;
          internal_notes: string | null;
        }
      | {
          name: string;
          website: string | null;
          segment: string | null;
          city: string | null;
          employee_count: string | null;
          approx_revenue: string | null;
          instagram: string | null;
          cnpj: string | null;
          postal_code: string | null;
          google_business_url: string | null;
          other_social_url: string | null;
          bio_link: string | null;
          internal_notes: string | null;
        }[]
      | null;
    crm_contacts:
      | {
          name: string;
          role_title: string | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          contact_preference: string | null;
        }
      | {
          name: string;
          role_title: string | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          contact_preference: string | null;
        }[]
      | null;
  };

  const oppRows = ((opportunities as unknown as RawOpp[]) ?? []).filter((o) => stageIds.has(o.stage_id)).map((o) => {
    const company = Array.isArray(o.crm_companies) ? o.crm_companies[0] : o.crm_companies;
    const contact = Array.isArray(o.crm_contacts) ? o.crm_contacts[0] : o.crm_contacts;
    const member = o.responsible_id ? memberById.get(o.responsible_id) : undefined;
    return {
      id: o.id,
      companyId: o.company_id,
      contactId: o.contact_id,
      stageId: o.stage_id,
      status: o.status,
      estimatedValue: o.estimated_value,
      serviceInterest: o.service_interest,
      acquisitionChannel: o.acquisition_channel,
      eventName: o.event_name,
      details: readDetails(o as unknown as Record<string, unknown>),
      companyExtra: readCompanyExtra(company as unknown as Record<string, unknown> | null),
      responsibleId: o.responsible_id,
      responsibleName: member?.full_name ?? null,
      responsiblePhoto: member?.photo_url ?? null,
      temperature: o.temperature,
      expectedCloseDate: o.expected_close_date,
      companyName: company?.name ?? "—",
      contactName: contact?.name ?? null,
      stageEnteredAt: lastStageChangeByOpp.get(o.id) ?? o.created_at,
      website: company?.website ?? null,
      segment: company?.segment ?? null,
      city: company?.city ?? null,
      employeeCount: company?.employee_count ?? null,
      approxRevenue: company?.approx_revenue ?? null,
      instagram: company?.instagram ?? null,
      contactRole: contact?.role_title ?? null,
      contactPhone: contact?.phone ?? null,
      contactWhatsapp: contact?.whatsapp ?? null,
      contactEmail: contact?.email ?? null,
      contactPreference: contact?.contact_preference ?? null,
    };
  });

  return (
    <FunilBoard
      stages={stages}
      pipelines={pipelines}
      selectedPipelineId={selectedPipeline?.id ?? ""}
      canManage={access.isFullAdmin}
      opportunities={oppRows}
      teamMembers={members}
    />
  );
}
