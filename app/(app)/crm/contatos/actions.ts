"use server";

import { findPipelineStage, getDefaultPipelineId } from "../stage-lookup";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateCompany, findOrCreateContact, type CrmFormState } from "../actions";
import { resolveContactName } from "../contactUtils";
import type { SystemFieldKey } from "./import-parse";

function companyFieldsFromForm(formData: FormData) {
  const str = (key: string) => (formData.get(key) as string)?.trim() || null;
  return {
    website: str("website"),
    segment: str("segment"),
    city: str("city"),
    internal_notes: str("internal_notes"),
    instagram: str("instagram"),
    postal_code: str("postal_code"),
    cnpj: str("cnpj"),
    google_business_url: str("google_business_url"),
    other_social_url: str("other_social_url"),
    bio_link: str("bio_link"),
  };
}

export async function createCompanyContactAction(
  _prevState: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const companyName = (formData.get("company_name") as string)?.trim();
  if (!companyName) return { error: "Nome da empresa é obrigatório." };

  const supabase = await createClient();

  try {
    const companyId = await findOrCreateCompany(supabase, companyName, companyFieldsFromForm(formData));

    const contactName = resolveContactName(formData, companyName);
    if (contactName) {
      await findOrCreateContact(supabase, companyId, contactName, {
        role_title: (formData.get("contact_role") as string)?.trim() || null,
        phone: (formData.get("contact_phone") as string)?.trim() || null,
        whatsapp: (formData.get("contact_whatsapp") as string)?.trim() || null,
        email: (formData.get("contact_email") as string)?.trim() || null,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }

  revalidatePath("/crm/contatos");
  return {};
}

// Edição: diferente de createCompanyContactAction (que acha/cria por
// nome), aqui já se sabe exatamente qual empresa/contato — atualiza
// direto pelo id, sem risco de casar com a linha errada por nome
// parecido.
export async function updateCompanyContactAction(
  _prevState: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const companyId = formData.get("company_id") as string;
  if (!companyId) return { error: "Empresa inválida." };

  const companyName = (formData.get("company_name") as string)?.trim();
  if (!companyName) return { error: "Nome da empresa é obrigatório." };

  const supabase = await createClient();

  const { error: companyError } = await supabase
    .from("crm_companies")
    .update({ name: companyName, ...companyFieldsFromForm(formData) })
    .eq("id", companyId);
  if (companyError) return { error: companyError.message };

  const contactId = (formData.get("contact_id") as string) || null;
  // Quando já existe contato (contactId), nome em branco continua
  // significando "remover" (ver abaixo) — a regra de usar o nome da
  // empresa como fallback só vale pra criar um contato novo, senão
  // ficaria impossível apagar um contato existente preenchendo só o
  // telefone por engano.
  const typedContactName = ((formData.get("contact_name") as string) || "").trim();
  const contactName = contactId ? typedContactName : resolveContactName(formData, companyName);
  const contactFields = {
    role_title: (formData.get("contact_role") as string)?.trim() || null,
    phone: (formData.get("contact_phone") as string)?.trim() || null,
    whatsapp: (formData.get("contact_whatsapp") as string)?.trim() || null,
    email: (formData.get("contact_email") as string)?.trim() || null,
  };

  if (contactId) {
    if (contactName) {
      const { error } = await supabase
        .from("crm_contacts")
        .update({ name: contactName, ...contactFields })
        .eq("id", contactId);
      if (error) return { error: error.message };
    } else {
      // Nome apagado no formulário = removeu o contato principal.
      const { error } = await supabase.from("crm_contacts").delete().eq("id", contactId);
      if (error) return { error: error.message };
    }
  } else if (contactName) {
    try {
      await findOrCreateContact(supabase, companyId, contactName, contactFields);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro inesperado." };
    }
  }

  revalidatePath("/crm/contatos");
  return {};
}

export async function deleteCompanyAction(companyId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_companies").delete().eq("id", companyId);
  revalidatePath("/crm/contatos");
  if (error) return { error: error.message };
  return {};
}

// Apaga várias de uma vez (seleção múltipla, ou "selecionar todos" pra
// zerar a lista inteira) — cascata remove contatos/oportunidades
// vinculados junto, igual deleteCompanyAction.
export async function deleteCompaniesAction(companyIds: string[]) {
  if (companyIds.length === 0) return { error: "Nenhuma empresa selecionada." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_companies").delete().in("id", companyIds);
  revalidatePath("/crm/contatos");
  if (error) return { error: error.message };
  return {};
}

export async function confirmImport(
  rows: string[][],
  mapping: (SystemFieldKey | null)[]
): Promise<{ error?: string; created: number; skipped: number }> {
  const supabase = await createClient();

  const companyIdx = mapping.indexOf("company_name");
  if (companyIdx === -1) {
    return { error: "Nenhuma coluna mapeada pra Nome da empresa.", created: 0, skipped: 0 };
  }

  // Etapa de entrada = a de role `lead` do pipeline padrão (o nome pode
  // ter sido trocado).
  const defaultPipelineId = await getDefaultPipelineId(supabase);
  const stage = defaultPipelineId
    ? await findPipelineStage(supabase, defaultPipelineId, { role: "lead" })
    : null;
  if (!stage) return { error: "Etapa de entrada (Novo lead) não encontrada.", created: 0, skipped: 0 };

  const get = (row: string[], key: SystemFieldKey) => {
    const idx = mapping.indexOf(key);
    return idx === -1 ? "" : (row[idx] ?? "").trim();
  };

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const companyName = get(row, "company_name");
    if (!companyName) {
      skipped++;
      continue;
    }

    try {
      const companyId = await findOrCreateCompany(supabase, companyName, {
        city: get(row, "city") || null,
        postal_code: get(row, "postal_code") || null,
        segment: get(row, "segment") || null,
        website: get(row, "website") || null,
        instagram: get(row, "instagram") || null,
        other_social_url: get(row, "other_social_url") || null,
        google_business_url: get(row, "google_business_url") || null,
        bio_link: get(row, "bio_link") || null,
        cnpj: get(row, "cnpj") || null,
      });

      const contactName = get(row, "contact_name");
      const contactId = contactName
        ? await findOrCreateContact(supabase, companyId, contactName, {
            role_title: get(row, "role_title") || null,
            phone: get(row, "phone") || null,
            whatsapp: get(row, "whatsapp") || null,
            email: get(row, "email") || null,
          })
        : null;

      await supabase.from("crm_opportunities").insert({
        company_id: companyId,
        contact_id: contactId,
        stage_id: stage.id,
        acquisition_channel: "Outro",
        first_touch_channel: "Outro",
        last_touch_channel: "Outro",
        search_reason: "Lead importado de planilha.",
      });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/crm/contatos");
  revalidatePath("/crm/funil");
  revalidatePath("/crm/visao-geral");
  return { created, skipped };
}
