"use server";

import { getDefaultPipelineId } from "../stage-lookup";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateCompany, findOrCreateContact, type CrmFormState } from "../actions";
import { resolveContactName } from "../contactUtils";
import { COMPANY_KEYS, pickContactFields, pickStrings } from "../form-fields";
import { getCrmSettings } from "../settings";
import { normalizeText, parseSheetDate, parseSheetNumber, type SystemFieldKey } from "./import-parse";

// Etapa de entrada dos leads novos: o pipeline pode ter mais de uma etapa
// com role `lead` (ex.: "Desbrava"); leads cadastrados entram em "Novo lead".
async function findNewLeadStage(supabase: Awaited<ReturnType<typeof createClient>>, pipelineId: string) {
  const { data } = await supabase
    .from("crm_stages")
    .select("id, name")
    .eq("pipeline_id", pipelineId)
    .eq("role", "lead")
    .order("position");
  const stages = data ?? [];
  return stages.find((st) => st.name.trim().toLowerCase() === "novo lead") ?? stages[0] ?? null;
}

// Edição simples (contato sem oportunidade): já se sabe exatamente qual empresa/contato — atualiza
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
    .update({ name: companyName, ...pickStrings(formData, COMPANY_KEYS) })
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
  const contactFields = pickContactFields(formData);

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

// Importação em lotes (o navegador manda ~25 linhas por vez; cada chamada cabe no tempo do servidor).
export type ImportResult = { error?: string; created: number; skipped: number; duplicates: number; unknownChannels: string[] };

export async function confirmImport(rows: string[][], mapping: (SystemFieldKey | null)[]): Promise<ImportResult> {
  const empty = (error: string): ImportResult => ({ error, created: 0, skipped: 0, duplicates: 0, unknownChannels: [] });
  if (rows.length > 60) return empty("Lote grande demais. Atualize a página e tente de novo.");
  const supabase = await createClient();
  const settings = await getCrmSettings();
  const isB2C = settings.businessModel === "b2c";

  // B2B precisa de "Nome da empresa"; em B2C (sem empresa) vale o nome do contato.
  const has = (key: SystemFieldKey) => mapping.indexOf(key) !== -1;
  if (!has("company_name") && !(isB2C && has("contact_name"))) {
    return empty(isB2C ? "Nenhuma coluna mapeada pra Nome do contato." : "Nenhuma coluna mapeada pra Nome da empresa.");
  }

  const defaultPipelineId = await getDefaultPipelineId(supabase);
  if (!defaultPipelineId) return empty("Fluxo não encontrado.");
  const leadStage = await findNewLeadStage(supabase, defaultPipelineId);
  if (!leadStage) return empty("Etapa de entrada (Lead) não encontrada.");

  // Etapas do fluxo e vendedores da conta, para casar o texto da planilha pelo nome.
  const [{ data: stageRows }, { data: memberRows }] = await Promise.all([
    supabase.from("crm_stages").select("id, name").eq("pipeline_id", defaultPipelineId),
    supabase.rpc("team_member_picker_options"),
  ]);
  const stageByName = new Map(((stageRows as { id: string; name: string }[] | null) ?? []).map((st) => [normalizeText(st.name), st.id]));
  const memberByName = new Map(((memberRows as { id: string; full_name: string }[] | null) ?? []).map((m) => [normalizeText(m.full_name), m.id]));
  const channelByName = new Map(settings.channels.map((c) => [normalizeText(c.name), c.name]));
  const fallbackChannel = channelByName.get("outro") ?? null;

  const get = (row: string[], key: SystemFieldKey) => {
    const idx = mapping.indexOf(key);
    return idx === -1 ? "" : (row[idx] ?? "").trim();
  };
  // "~", "-" e vazio são "sem informação" nas planilhas.
  const real = (v: string) => (v === "" || v === "~" || v === "-" || v === "–" ? "" : v);

  let created = 0;
  let skipped = 0;
  let duplicates = 0;
  const unknownChannels = new Set<string>();

  for (const row of rows) {
    const phone = real(get(row, "phone"));
    const whatsapp = real(get(row, "whatsapp"));
    const contactName = real(get(row, "contact_name"));
    // Lead sem nome mas com telefone não se perde: entra como "Lead <telefone>".
    const personName = contactName || (phone || whatsapp ? `Lead ${phone || whatsapp}` : "");
    const companyName = real(get(row, "company_name")) || (isB2C ? personName : "");
    if (!companyName) {
      skipped++;
      continue;
    }

    try {
      // Já existe um lead com esse telefone/WhatsApp? Não duplica (importar a mesma planilha de novo é seguro).
      const known = [phone, whatsapp].filter(Boolean);
      if (known.length > 0) {
        // Aspas protegem parênteses, vírgulas e espaços do telefone no filtro.
        const q = (p: string) => `"${p.replace(/"/g, "")}"`;
        const filter = known.flatMap((p) => [`phone.eq.${q(p)}`, `whatsapp.eq.${q(p)}`]).join(",");
        const { data: dup } = await supabase.from("crm_contacts").select("id").or(filter).limit(1);
        if (dup && dup.length > 0) {
          duplicates++;
          continue;
        }
      }

      const entryDate = parseSheetDate(get(row, "entry_date"));
      const createdAt = entryDate ? `${entryDate}T12:00:00-03:00` : null;

      // Origem: casa com as origens da conta (sem acento nem maiúsculas); fora da lista, guarda como veio.
      const channelRaw = real(get(row, "acquisition_channel"));
      let channel: string | null = fallbackChannel;
      if (channelRaw) {
        const matched = channelByName.get(normalizeText(channelRaw));
        channel = matched ?? channelRaw;
        if (!matched) unknownChannels.add(channelRaw);
      }

      const stageRaw = real(get(row, "stage"));
      const stageId = (stageRaw && stageByName.get(normalizeText(stageRaw))) || leadStage.id;
      const responsibleRaw = real(get(row, "responsible"));
      const responsibleId = responsibleRaw ? (memberByName.get(normalizeText(responsibleRaw)) ?? null) : null;
      const tempRaw = normalizeText(real(get(row, "temperature")));
      const temperature = ["quente", "morno", "frio"].includes(tempRaw) ? tempRaw : null;
      const value = settings.salesMode === "contratos" ? null : parseSheetNumber(real(get(row, "estimated_value")));

      const companyFields = {
        city: real(get(row, "city")) || null,
        postal_code: real(get(row, "postal_code")) || null,
        segment: real(get(row, "segment")) || null,
        website: real(get(row, "website")) || null,
        instagram: real(get(row, "instagram")) || null,
        other_social_url: real(get(row, "other_social_url")) || null,
        google_business_url: real(get(row, "google_business_url")) || null,
        bio_link: real(get(row, "bio_link")) || null,
        cnpj: real(get(row, "cnpj")) || null,
        internal_notes: real(get(row, "notes")) || null,
      };
      // B2C: cada pessoa é um cliente próprio (nomes iguais não se misturam); B2B: junta pelo nome da empresa.
      let companyId: string;
      if (isB2C) {
        const { data: createdCompany, error } = await supabase.from("crm_companies").insert({ name: companyName, ...companyFields }).select("id").single();
        if (error) throw new Error(error.message);
        companyId = createdCompany.id;
      } else {
        companyId = await findOrCreateCompany(supabase, companyName, companyFields);
      }

      const contactFields = {
        role_title: real(get(row, "role_title")) || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: real(get(row, "email")) || null,
      };
      let contactId: string | null = null;
      if (personName) {
        if (isB2C) {
          const { data: createdContact, error } = await supabase.from("crm_contacts").insert({ company_id: companyId, name: personName, ...contactFields }).select("id").single();
          if (error) throw new Error(error.message);
          contactId = createdContact.id;
        } else {
          contactId = await findOrCreateContact(supabase, companyId, personName, contactFields);
        }
      }

      const { data: opp, error: oppError } = await supabase
        .from("crm_opportunities")
        .insert({
          company_id: companyId,
          contact_id: contactId,
          stage_id: stageId,
          acquisition_channel: channel,
          first_touch_channel: channel,
          last_touch_channel: channel,
          priority: real(get(row, "priority")) || null,
          temperature,
          responsible_id: responsibleId,
          estimated_value: value,
          search_reason: "Lead importado de planilha.",
          ...(createdAt ? { created_at: createdAt, entered_at: createdAt } : {}),
        })
        .select("id")
        .single();
      if (oppError) throw new Error(oppError.message);

      // "Comentários e atividade" da planilha vira anotação na linha do tempo do lead.
      const comment = real(get(row, "activity"));
      if (comment && opp) {
        await supabase.from("crm_activities").insert({
          opportunity_id: opp.id,
          type: "anotacao",
          content: comment.slice(0, 1000),
          ...(createdAt ? { occurred_at: createdAt } : {}),
        });
      }
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/crm/contatos");
  revalidatePath("/crm/funil");
  revalidatePath("/crm/visao-geral");
  return { created, skipped, duplicates, unknownChannels: Array.from(unknownChannels) };
}
