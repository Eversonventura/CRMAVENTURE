import { createClient } from "@/lib/supabase/server";
import { ContatosEmpresasList } from "./ContatosEmpresasList";
import { getDefaultPipelineId } from "../stage-lookup";
import type { CrmStage, TeamMemberOption } from "../types";

export default async function CrmContatosPage() {
  const supabase = await createClient();
  const [{ data: pendingTasks }] = await Promise.all([
    supabase
      .from("crm_tasks")
      .select("opportunity_id, type, due_at")
      .eq("status", "pendente")
      .order("due_at")
      .limit(2000),
  ]);
  const nextTaskByOpp = new Map<string, { type: string; dueAt: string }>();
  for (const t of (pendingTasks as { opportunity_id: string; type: string; due_at: string }[] | null) ?? []) {
    if (!nextTaskByOpp.has(t.opportunity_id)) nextTaskByOpp.set(t.opportunity_id, { type: t.type, dueAt: t.due_at });
  }

  // Para "+ Adicionar" abrir o mesmo formulário do Fluxo: etapas do fluxo padrão e a equipe.
  const defaultPipelineId = await getDefaultPipelineId(supabase);
  const [{ data: stageRows }, { data: teamMembers }] = await Promise.all([
    supabase
      .from("crm_stages")
      .select("id, name, position, color, pipeline_id, kind, role")
      .eq("pipeline_id", defaultPipelineId ?? "")
      .order("position"),
    supabase.rpc("team_member_picker_options"),
  ]);

  const { data: companies } = await supabase
    .from("crm_companies")
    .select(
      "id, name, segment, city, website, internal_notes, instagram, postal_code, cnpj, google_business_url, other_social_url, bio_link, crm_contacts(id, name, role_title, phone, whatsapp, email), crm_opportunities(id, status)"
    )
    .order("name");

  type RawRow = {
    id: string;
    name: string;
    segment: string | null;
    city: string | null;
    website: string | null;
    internal_notes: string | null;
    instagram: string | null;
    postal_code: string | null;
    cnpj: string | null;
    google_business_url: string | null;
    other_social_url: string | null;
    bio_link: string | null;
    crm_contacts: {
      id: string;
      name: string;
      role_title: string | null;
      phone: string | null;
      whatsapp: string | null;
      email: string | null;
    }[] | null;
    crm_opportunities: {
      id: string;
      status: "aberta" | "fechada" | "perdida";
      stage_id: string;
      crm_stages: { name: string; color: string | null } | { name: string; color: string | null }[] | null;
    }[] | null;
  };

  const rows = ((companies as RawRow[] | null) ?? []).map((c) => {
    const openOpportunities = (c.crm_opportunities ?? []).filter((o) => o.status === "aberta");
    const mainOpp = openOpportunities[0] ?? null;
    const mainStage = mainOpp ? (Array.isArray(mainOpp.crm_stages) ? mainOpp.crm_stages[0] : mainOpp.crm_stages) : null;
    return {
      id: c.id,
      stageName: mainStage?.name ?? null,
      stageColor: mainStage?.color ?? null,
      nextTask: mainOpp ? (nextTaskByOpp.get(mainOpp.id) ?? null) : null,
      name: c.name,
      segment: c.segment,
      city: c.city,
      website: c.website,
      internalNotes: c.internal_notes,
      instagram: c.instagram,
      postalCode: c.postal_code,
      cnpj: c.cnpj,
      googleBusinessUrl: c.google_business_url,
      otherSocialUrl: c.other_social_url,
      bioLink: c.bio_link,
      opportunityCount: c.crm_opportunities?.length ?? 0,
      openOpportunityId: openOpportunities.length === 1 ? openOpportunities[0].id : null,
      // Oportunidade que o "Editar" abre (a aberta, ou a mais recente): mesmo formulário do Fluxo.
      editOpportunityId: (openOpportunities[0] ?? (c.crm_opportunities ?? [])[0])?.id ?? null,
      openOpportunityCount: openOpportunities.length,
      primaryContact: c.crm_contacts?.[0] ?? null,
      contactCount: c.crm_contacts?.length ?? 0,
    };
  });

  return (
    <ContatosEmpresasList
      companies={rows}
      stages={(stageRows as CrmStage[] | null) ?? []}
      teamMembers={(teamMembers as TeamMemberOption[] | null) ?? []}
    />
  );
}
