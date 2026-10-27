"use server";

import { findPipelineStage } from "./stage-lookup";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { resolveContactName } from "./contactUtils";
import { logCrmActivity } from "./activity";
import { cancelActiveCadences, startCadence, type CadenceType } from "./cadence";
import { sendCrmEmail } from "./email";
import { rescheduleAfterComplete, syncOpportunityTasks } from "./followup-engine";
import { TASK_TYPE_LABELS, type TaskType } from "./types";

export type CrmFormState = { error?: string };

// Uma mudança de etapa/oportunidade mexe em funil, tarefas, Diário,
// propostas, contatos e visão geral — revalida tudo junto pra as telas não
// ficarem dessincronizadas.
function revalidateCrmViews() {
  for (const path of ["/crm/visao-geral", "/crm/funil", "/crm/tarefas", "/crm/diario", "/crm/propostas", "/crm/contatos", "/crm/agenda"]) {
    revalidatePath(path);
  }
}

// Empresa não é recriada a cada oportunidade nova — busca por nome
// (case-insensitive) antes de criar.
export async function findOrCreateCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  fields: Record<string, unknown>
) {
  const trimmed = name.trim();

  // CNPJ é um identificador mais confiável que nome (mesma empresa pode
  // vir escrita diferente entre planilhas — com/sem acento, "Ltda" no
  // fim, espaço a mais). Quando a linha importada tem CNPJ, tenta casar
  // por ele primeiro; só cai pro nome se não tiver CNPJ ou não achar.
  const cnpj = typeof fields.cnpj === "string" ? fields.cnpj.trim() : "";
  if (cnpj) {
    const { data: byCnpj } = await supabase
      .from("crm_companies")
      .select("id")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (byCnpj) {
      const { error } = await supabase.from("crm_companies").update(fields).eq("id", byCnpj.id);
      if (error) throw new Error(error.message);
      return byCnpj.id;
    }
  }

  const { data: existing } = await supabase
    .from("crm_companies")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) {
    // Bug real: esse update não checava erro — se falhasse (RLS, tipo
    // de dado etc.), o formulário fechava como se tivesse salvo, mas
    // os campos continuavam com o valor antigo (ex: telefone não
    // "salvando").
    const { error } = await supabase.from("crm_companies").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("crm_companies")
    .insert({ name: trimmed, ...fields })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export async function findOrCreateContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  name: string,
  fields: Record<string, unknown>
) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // E-mail é mais estável que nome escrito (apelido, abreviação,
  // acento) entre importações diferentes — tenta casar por ele primeiro
  // dentro da mesma empresa.
  const email = typeof fields.email === "string" ? fields.email.trim() : "";
  if (email) {
    const { data: byEmail } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("company_id", companyId)
      .ilike("email", email)
      .maybeSingle();
    if (byEmail) {
      const { error } = await supabase.from("crm_contacts").update(fields).eq("id", byEmail.id);
      if (error) throw new Error(error.message);
      return byEmail.id;
    }
  }

  const { data: existing } = await supabase
    .from("crm_contacts")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) {
    // Mesmo bug do findOrCreateCompany acima: sem checar o erro, um
    // update que falhasse silenciosamente dava a impressão de "salvou"
    // enquanto o telefone/whatsapp continuava com o valor antigo.
    const { error } = await supabase.from("crm_contacts").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("crm_contacts")
    .insert({ company_id: companyId, name: trimmed, ...fields })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

function readCompanyExtraFields(formData: FormData) {
  const str = (key: string) => (formData.get(key) as string)?.trim() || null;
  return {
    cnpj: str("cnpj"),
    postal_code: str("postal_code"),
    google_business_url: str("google_business_url"),
    other_social_url: str("other_social_url"),
    bio_link: str("bio_link"),
    internal_notes: str("internal_notes"),
  };
}

function readOpportunityFields(formData: FormData) {
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v ? Number(v) : null;
  };
  const str = (key: string) => (formData.get(key) as string)?.trim() || null;

  return {
    service_interest: str("service_interest"),
    estimated_value: num("estimated_value"),
    close_probability: num("close_probability"),
    expected_close_date: str("expected_close_date"),
    responsible_id: str("responsible_id"),
    temperature: str("temperature"),
    priority: str("priority"),
    search_reason: str("search_reason"),
    main_problem: str("main_problem"),
    desired_objective: str("desired_objective"),
    available_budget: str("available_budget"),
    decision_maker: str("decision_maker"),
    start_deadline: str("start_deadline"),
    acquisition_channel: str("acquisition_channel"),
    campaign: str("campaign"),
    event_name: str("event_name"),
    ad: str("ad"),
    form_name: str("form_name"),
    landing_page: str("landing_page"),
    referred_by: str("referred_by"),
    referral_related_client: str("referral_related_client"),
    referral_type: str("referral_type"),
    referral_date: str("referral_date"),
    referral_result: str("referral_result"),
    ad_platform: str("ad_platform"),
    ad_set: str("ad_set"),
    keyword: str("keyword"),
  };
}

export async function createOpportunityAction(
  _prevState: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const companyName = (formData.get("company_name") as string)?.trim();
  if (!companyName) return { error: "Nome da empresa é obrigatório." };

  const supabase = await createClient();

  try {
    // Empresa nova: só grava os extras preenchidos (não apaga dados de uma
    // empresa que já existia com o mesmo nome).
    const extraOnCreate = Object.fromEntries(Object.entries(readCompanyExtraFields(formData)).filter(([, v]) => v !== null));
    const companyId = await findOrCreateCompany(supabase, companyName, {
      ...extraOnCreate,
      website: (formData.get("website") as string)?.trim() || null,
      segment: (formData.get("segment") as string)?.trim() || null,
      city: (formData.get("city") as string)?.trim() || null,
      employee_count: (formData.get("employee_count") as string)?.trim() || null,
      approx_revenue: (formData.get("approx_revenue") as string)?.trim() || null,
      instagram: (formData.get("instagram") as string)?.trim() || null,
    });

    const contactName = resolveContactName(formData, companyName);
    const contactId = await findOrCreateContact(supabase, companyId, contactName, {
      role_title: (formData.get("contact_role") as string)?.trim() || null,
      phone: (formData.get("contact_phone") as string)?.trim() || null,
      whatsapp: (formData.get("contact_whatsapp") as string)?.trim() || null,
      email: (formData.get("contact_email") as string)?.trim() || null,
      contact_preference: (formData.get("contact_preference") as string)?.trim() || null,
    });

    const fields = readOpportunityFields(formData);
    const stageId = formData.get("stage_id") as string;
    if (!stageId) return { error: "Selecione a etapa." };

    const { data: created, error } = await supabase
      .from("crm_opportunities")
      .insert({
        company_id: companyId,
        contact_id: contactId,
        stage_id: stageId,
        first_touch_channel: fields.acquisition_channel,
        last_touch_channel: fields.acquisition_channel,
        ...fields,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    if (created) await syncOpportunityTasks(supabase, created.id, stageId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }

  revalidateCrmViews();
  return {};
}

export async function updateOpportunityAction(
  _prevState: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "Oportunidade inválida." };

  const supabase = await createClient();

  try {
    const companyName = (formData.get("company_name") as string)?.trim();
    if (companyName) {
      // Bug real ("dado duplicado/dessincronizado"): editar uma
      // oportunidade sempre re-resolvia empresa/contato pelo NOME
      // digitado, mesmo já sabendo o id de verdade (a oportunidade já
      // está ligada a uma empresa e a um contato específicos). Corrigir
      // um erro de digitação no nome, por exemplo, fazia o
      // findOrCreateCompany/findOrCreateContact não encontrar a linha
      // existente (nome mudou) e CRIAR uma linha nova — a oportunidade
      // passava a apontar pra esse registro novo, deixando o antigo
      // órfão/duplicado. Agora, tendo o id (hidden field do form),
      // atualiza a linha existente direto — só usa a busca por nome
      // (findOrCreateCompany/findOrCreateContact) quando ainda não
      // existe empresa/contato vinculado.
      const companyFields = {
        website: (formData.get("website") as string)?.trim() || null,
        segment: (formData.get("segment") as string)?.trim() || null,
        city: (formData.get("city") as string)?.trim() || null,
        employee_count: (formData.get("employee_count") as string)?.trim() || null,
        approx_revenue: (formData.get("approx_revenue") as string)?.trim() || null,
        instagram: (formData.get("instagram") as string)?.trim() || null,
        // Demais dados da empresa (iguais aos de Contatos & Empresas): o card
        // agora mostra todos, então podem ser gravados como estão.
        ...readCompanyExtraFields(formData),
      };
      const existingCompanyId = (formData.get("company_id") as string) || null;
      let companyId: string;
      if (existingCompanyId) {
        const { error } = await supabase
          .from("crm_companies")
          .update({ name: companyName, ...companyFields })
          .eq("id", existingCompanyId);
        if (error) throw new Error(error.message);
        companyId = existingCompanyId;
      } else {
        companyId = await findOrCreateCompany(supabase, companyName, companyFields);
      }

      const contactFields = {
        role_title: (formData.get("contact_role") as string)?.trim() || null,
        phone: (formData.get("contact_phone") as string)?.trim() || null,
        whatsapp: (formData.get("contact_whatsapp") as string)?.trim() || null,
        email: (formData.get("contact_email") as string)?.trim() || null,
        contact_preference: (formData.get("contact_preference") as string)?.trim() || null,
      };
      const existingContactId = (formData.get("contact_id") as string) || null;
      // Bug real ("adicionei informações e não tá salvando"): se o
      // vendedor preenchia telefone/WhatsApp/e-mail mas deixava "Nome
      // do contato" em branco (esquecimento comum, já que o nome nem
      // sempre é a info mais importante do lead), o código antigo
      // tratava nome vazio como "quero apagar o contato" e DELETAVA a
      // linha inteira — jogando fora os campos que acabaram de ser
      // digitados na mesma tela. Agora usa o mesmo fallback já usado
      // ao criar um contato novo (nome da empresa, só quando existe
      // algum outro dado de contato preenchido); só apaga de verdade
      // quando TODOS os campos de contato estão vazios.
      const contactName = resolveContactName(formData, companyName);
      let contactId: string | null;
      if (existingContactId) {
        if (contactName) {
          const { error } = await supabase
            .from("crm_contacts")
            .update({ name: contactName, ...contactFields })
            .eq("id", existingContactId);
          if (error) throw new Error(error.message);
          contactId = existingContactId;
        } else {
          const { error } = await supabase.from("crm_contacts").delete().eq("id", existingContactId);
          if (error) throw new Error(error.message);
          contactId = null;
        }
      } else {
        contactId = await findOrCreateContact(supabase, companyId, contactName, contactFields);
      }

      const fields = readOpportunityFields(formData);
      const stageId = formData.get("stage_id") as string;

      const { data: before } = await supabase
        .from("crm_opportunities")
        .select("acquisition_channel, stage_id")
        .eq("id", id)
        .single();

      // first_touch_channel nunca muda depois de gravado; last_touch só
      // atualiza quando o canal informado agora é diferente do anterior.
      const channelChanged = before && before.acquisition_channel !== fields.acquisition_channel;

      const { error } = await supabase
        .from("crm_opportunities")
        .update({
          company_id: companyId,
          contact_id: contactId,
          stage_id: stageId,
          ...fields,
          ...(channelChanged ? { last_touch_channel: fields.acquisition_channel } : {}),
        })
        .eq("id", id);
      if (error) return { error: error.message };
      if (stageId && stageId !== before?.stage_id) {
        await syncOpportunityTasks(supabase, id, stageId, before?.stage_id);
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }

  revalidateCrmViews();
  return {};
}

// Mover card no board — o trigger crm_opportunities_stage_history já
// registra a mudança automaticamente; aqui só grava a entrada
// correspondente na linha do tempo (crm_activities).
export async function updateStageColor(stageId: string, color: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_stages").update({ color }).eq("id", stageId);
  if (error) return { error: error.message };
  revalidatePath("/crm/funil");
  return {};
}

export async function moveOpportunityStage(id: string, stageId: string) {
  const supabase = await createClient();

  const { data: beforeRaw } = await supabase
    .from("crm_opportunities")
    .select("stage_id, crm_stages(name, role)")
    .eq("id", id)
    .single();
  const before = beforeRaw as unknown as {
    stage_id: string;
    crm_stages: { name: string; role: string | null } | { name: string; role: string | null }[] | null;
  } | null;
  const { data: toStage } = await supabase
    .from("crm_stages")
    .select("name, kind, role")
    .eq("id", stageId)
    .single();

  const { error: moveError } = await supabase
    .from("crm_opportunities")
    .update({ stage_id: stageId })
    .eq("id", id);
  // O board (FunilBoard.tsx) já moveu o card na tela de forma otimista
  // antes de chamar essa action; se o update falhar aqui, devolve o
  // erro pro board desfazer o movimento em vez de deixar o card "preso"
  // numa coluna que não bate com o banco, sem erro nenhum aparecer.
  if (moveError) return { error: moveError.message };

  const fromStage = Array.isArray(before?.crm_stages) ? before?.crm_stages[0] : before?.crm_stages;
  const fromName = fromStage?.name;
  await logCrmActivity(
    supabase,
    id,
    "mudanca_etapa",
    `${fromName ?? "?"} → ${toStage?.name ?? "?"}`
  );

  // Tarefas da etapa: cancela os follow-ups automáticos da etapa anterior e
  // agenda o da nova, conforme as regras configuradas em Tarefas (inclui o
  // antigo "Preparar proposta", que agora é uma regra da etapa de diagnóstico).
  await syncOpportunityTasks(supabase, id, stageId, before?.stage_id);

  // Automação: etapa do tipo "ganho" (kind = won, a antiga "Fechado") →
  // cria/linka cliente no módulo Clientes (nunca duplica — busca por nome
  // antes de criar) e marca a oportunidade como fechada.
  if (toStage?.kind === "won") {
    const { data: opp } = await supabase
      .from("crm_opportunities")
      .select("company_id, crm_companies(name)")
      .eq("id", id)
      .single();
    const company = Array.isArray(opp?.crm_companies) ? opp?.crm_companies[0] : opp?.crm_companies;
    const companyName = company?.name?.trim();

    if (companyName) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .ilike("company_name", companyName)
        .maybeSingle();

      let clientId = existingClient?.id;
      if (!clientId) {
        const { data: createdClient } = await supabase
          .from("clients")
          .insert({ company_name: companyName, label_color: "#FF007A" })
          .select("id")
          .single();
        clientId = createdClient?.id;
      }

      await supabase
        .from("crm_opportunities")
        .update({ status: "fechada", won_client_id: clientId })
        .eq("id", id);
      await logCrmActivity(supabase, id, "automacao", "Oportunidade fechada — cliente vinculado.");
    }
  }

  revalidateCrmViews();
  return {};
}

// Atalho pra registrar "tentei contatar esse lead" direto da tela de
// Contatos/Empresas, sem precisar abrir o Funil e achar o card. Se a
// oportunidade ainda está em "Novo lead", avança ela pra "Tentativa de
// contato" (mesmo efeito de arrastar o card no Funil); se já passou
// dessa etapa, só registra mais uma tentativa na linha do tempo sem
// mexer na etapa atual (não faz sentido "voltar" o funil).
export async function registerContactAttempt(opportunityId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: oppRaw } = await supabase
    .from("crm_opportunities")
    .select("crm_stages(position, pipeline_id)")
    .eq("id", opportunityId)
    .single();
  if (!oppRaw) return { error: "Oportunidade não encontrada." };
  const currentStage = Array.isArray(oppRaw.crm_stages) ? oppRaw.crm_stages[0] : oppRaw.crm_stages;

  // A etapa "Tentativa de contato" é a de role `tentativa` do pipeline da
  // oportunidade (o nome pode ter sido trocado).
  const tentativaStage = currentStage?.pipeline_id
    ? await findPipelineStage(supabase, currentStage.pipeline_id, { role: "tentativa" })
    : null;

  if (tentativaStage && (currentStage?.position ?? -1) < tentativaStage.position) {
    const result = await moveOpportunityStage(opportunityId, tentativaStage.id);
    if (result?.error) return result;
  } else {
    await logCrmActivity(supabase, opportunityId, "ligacao", "Tentativa de contato registrada.");
  }

  revalidateCrmViews();
  return {};
}

// --- Tarefas (Sprint 3) ---

export async function createTaskAction(
  _prevState: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const opportunityId = formData.get("opportunity_id") as string;
  const type = formData.get("type") as string;
  const dueAt = formData.get("due_at") as string;
  if (!opportunityId) return { error: "Oportunidade inválida." };
  if (!type) return { error: "Selecione o tipo de tarefa." };
  if (!dueAt) return { error: "Selecione a data/hora." };

  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").insert({
    opportunity_id: opportunityId,
    type,
    due_at: new Date(dueAt).toISOString(),
    responsible_id: (formData.get("responsible_id") as string) || null,
    priority: (formData.get("priority") as string) || null,
    description: (formData.get("description") as string)?.trim() || null,
  });
  if (error) return { error: error.message };

  // Automação: reunião agendada → e-mail de confirmação pro contato.
  if (type === "agendar_reuniao" || type === "realizar_reuniao") {
    const { data: opp } = await supabase
      .from("crm_opportunities")
      .select("crm_contacts(name, email), crm_companies(name)")
      .eq("id", opportunityId)
      .single();
    const contact = Array.isArray(opp?.crm_contacts) ? opp?.crm_contacts[0] : opp?.crm_contacts;
    const company = Array.isArray(opp?.crm_companies) ? opp?.crm_companies[0] : opp?.crm_companies;
    if (contact?.email) {
      await sendCrmEmail(
        [contact.email],
        `Reunião confirmada${company?.name ? ` — ${company.name}` : ""}`,
        `Olá${contact.name ? `, ${contact.name}` : ""}! Sua reunião está confirmada para ${new Date(
          dueAt
        ).toLocaleString("pt-BR")}.`
      );
    }
  }

  revalidatePath("/crm/tarefas");
  revalidatePath("/crm/funil");
  return {};
}

// Regra central: ao concluir uma tarefa, força a pergunta "qual é a
// próxima ação?" — cria a próxima tarefa junto na mesma chamada, ou
// aceita null quando o usuário escolhe "sem próxima ação por agora"
// (botão discreto, não o caminho padrão).
export async function completeTaskAction(
  taskId: string,
  activityResult: string,
  nextTask: {
    opportunityId: string;
    type: string;
    dueAt: string;
    responsibleId: string | null;
    priority: string | null;
    description: string | null;
  } | null
) {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("crm_tasks")
    .select("opportunity_id, type, source, stage_id")
    .eq("id", taskId)
    .single();

  await supabase
    .from("crm_tasks")
    .update({ status: "concluida", activity_result: activityResult || null, completed_at: new Date().toISOString() })
    .eq("id", taskId);

  if (task) {
    const label = TASK_TYPE_LABELS[task.type as TaskType] ?? task.type;
    await logCrmActivity(
      supabase,
      task.opportunity_id,
      "tarefa",
      activityResult ? `${label}: ${activityResult}` : label
    );
  }

  if (nextTask) {
    await supabase.from("crm_tasks").insert({
      opportunity_id: nextTask.opportunityId,
      type: nextTask.type,
      due_at: new Date(nextTask.dueAt).toISOString(),
      responsible_id: nextTask.responsibleId,
      priority: nextTask.priority,
      description: nextTask.description,
    });
  } else if (task?.source === "followup") {
    // Sem próxima ação definida à mão: a regra da etapa agenda o próximo
    // ciclo, se o card ainda estiver nela.
    await rescheduleAfterComplete(supabase, task);
  }

  revalidatePath("/crm/tarefas");
  revalidatePath("/crm/funil");
  revalidatePath("/crm/diario");
  revalidatePath("/crm/visao-geral");
}

// Próxima etapa "em andamento" do pipeline da oportunidade (a de posição
// logo depois da atual) — usada pelo botão "Respondeu → próxima etapa" ao
// concluir um follow-up. Sem próxima etapa aberta (ex.: já na última antes de
// Fechado/Perdido), devolve null.
export async function getNextStage(opportunityId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("crm_opportunities")
    .select("stage_id, crm_stages(position, pipeline_id)")
    .eq("id", opportunityId)
    .single();
  const current = Array.isArray(opp?.crm_stages) ? opp?.crm_stages[0] : opp?.crm_stages;
  if (!current) return null;

  const { data: next } = await supabase
    .from("crm_stages")
    .select("id, name")
    .eq("pipeline_id", current.pipeline_id)
    .eq("kind", "open")
    // Stand-by é um desvio de aquecimento (o lead sem interesse agora), não o
    // próximo passo do funil: "Respondeu → próxima etapa" pula essa etapa.
    .or("role.is.null,role.neq.standby")
    .gt("position", current.position)
    .order("position")
    .limit(1)
    .maybeSingle();
  return next ?? null;
}

// Conclui a tarefa e já avança o card pra próxima etapa (um clique). A regra
// da etapa nova agenda sozinha o próximo follow-up, então não pede "qual é a
// próxima ação". Avançar continua sendo uma decisão do usuário (botão).
export async function completeTaskAndAdvance(
  taskId: string,
  activityResult: string,
  opportunityId: string,
  nextStageId: string
): Promise<{ error?: string }> {
  await completeTaskAction(taskId, activityResult, null);
  const moved = await moveOpportunityStage(opportunityId, nextStageId);
  if (moved?.error) return { error: moved.error };
  revalidateCrmViews();
  return {};
}

export async function cancelTaskAction(taskId: string) {
  const supabase = await createClient();
  await supabase.from("crm_tasks").update({ status: "cancelada" }).eq("id", taskId);
  revalidatePath("/crm/tarefas");
  revalidatePath("/crm/diario");
}

// Automação: reunião marcada como não realizada → inicia resgate por
// ausência (Sprint 7), em vez de simplesmente cancelar a tarefa.
export async function markMeetingNotHeld(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("crm_tasks")
    .select("opportunity_id")
    .eq("id", taskId)
    .single();

  await supabase.from("crm_tasks").update({ status: "cancelada" }).eq("id", taskId);

  if (task) {
    await startCadence(supabase, task.opportunity_id, "resgate_reuniao");
    await logCrmActivity(supabase, task.opportunity_id, "automacao", "Reunião não realizada — resgate por ausência iniciado.");
  }

  revalidatePath("/crm/tarefas");
  revalidatePath("/crm/funil");
}

export async function markOpportunityLost(
  id: string,
  lossReason: string,
  lossDetails: string,
  moveToNurturing: boolean,
  nurturingReturnDate: string | null
) {
  const supabase = await createClient();
  const { data: oppForLoss } = await supabase
    .from("crm_opportunities")
    .select("responsible_id, crm_stages(pipeline_id)")
    .eq("id", id)
    .single();
  const lossStageRef = Array.isArray(oppForLoss?.crm_stages)
    ? oppForLoss?.crm_stages[0]
    : oppForLoss?.crm_stages;
  // Etapa de perda = a de kind `lost` do pipeline da oportunidade.
  const lostStage = lossStageRef?.pipeline_id
    ? await findPipelineStage(supabase, lossStageRef.pipeline_id, { kind: "lost" })
    : null;

  if (moveToNurturing && nurturingReturnDate) {
    const opp = oppForLoss;

    await supabase
      .from("crm_opportunities")
      .update({
        loss_reason: lossReason,
        loss_details: lossDetails,
        in_nurturing: true,
        nurturing_return_date: nurturingReturnDate,
      })
      .eq("id", id);

    // Automação: agenda automaticamente uma tarefa pro dia da volta,
    // devolvendo a oportunidade pro responsável.
    await supabase.from("crm_tasks").insert({
      opportunity_id: id,
      type: "follow_up",
      due_at: new Date(`${nurturingReturnDate}T09:00:00`).toISOString(),
      responsible_id: opp?.responsible_id ?? null,
      description: "Retorno de nutrição — \"Não é o momento\".",
    });
  } else {
    await supabase
      .from("crm_opportunities")
      .update({
        status: "perdida",
        loss_reason: lossReason,
        loss_details: lossDetails,
        stage_id: lostStage?.id,
      })
      .eq("id", id);
    if (lostStage) await syncOpportunityTasks(supabase, id, lostStage.id);
  }

  await logCrmActivity(
    supabase,
    id,
    "motivo_perda",
    `${lossReason}${lossDetails ? ` — ${lossDetails}` : ""}${
      moveToNurturing ? ` (nutrição, retorno em ${nurturingReturnDate})` : ""
    }`
  );

  revalidateCrmViews();
}

// --- Linha do tempo (Sprint 5) — anotação/ligação/e-mail/mensagem
// manual do vendedor, além do que já é logado automaticamente.
export async function addManualActivity(
  opportunityId: string,
  type: "mensagem" | "ligacao" | "email" | "reuniao" | "anotacao",
  content: string
) {
  if (content.length > 1000) return { error: "Comentário: máximo de 1000 caracteres." };

  const supabase = await createClient();
  await logCrmActivity(supabase, opportunityId, type, content);

  // Resposta do lead durante uma cadência ativa cancela os passos
  // restantes — mensagem/ligação/e-mail é o sinal de resposta.
  if (type === "mensagem" || type === "ligacao" || type === "email") {
    await cancelActiveCadences(supabase, opportunityId);
  }

  revalidatePath("/crm/funil");
}

// --- Cadências (Sprint 7) ---

export async function startCadenceAction(opportunityId: string, cadenceType: CadenceType) {
  const supabase = await createClient();
  await startCadence(supabase, opportunityId, cadenceType);
  await logCrmActivity(
    supabase,
    opportunityId,
    "automacao",
    `Cadência de ${cadenceType === "resgate_conversa" ? "resgate de conversa" : "resgate por ausência"} iniciada.`
  );
  revalidatePath("/crm/funil");
}

// --- Propostas: visão sincronizada com o funil (sprint 183) ---
// Não há mais cadastro manual: valor/cliente/etapa vêm da própria oportunidade.
export async function updateProposalValue(opportunityId: string, value: number | null): Promise<{ error?: string }> {
  if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: "Valor inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_opportunities")
    .update({ estimated_value: value })
    .eq("id", opportunityId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sem permissão pra editar essa oportunidade." };
  revalidatePath("/crm/propostas");
  revalidatePath("/crm/funil");
  revalidatePath("/crm/visao-geral");
  return {};
}

// Editar um comentário manual já enviado (errou e quer corrigir) —
// só pros tipos digitados pelo vendedor (mensagem/ligação/e-mail/
// reunião/anotação); mudança de etapa, automação, proposta, motivo de
// perda e arquivo são gerados pelo sistema e não fazem sentido editar.
export async function updateManualActivity(activityId: string, content: string) {
  if (!content.trim()) return { error: "Comentário não pode ficar vazio." };
  if (content.length > 1000) return { error: "Comentário: máximo de 1000 caracteres." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_activities")
    .update({ content: content.trim() })
    .eq("id", activityId)
    .in("type", ["mensagem", "ligacao", "email", "reuniao", "anotacao"]);

  if (error) return { error: error.message };
  revalidatePath("/crm/funil");
  return {};
}

export async function getOpportunityActivities(opportunityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_activities")
    .select("id, type, content, file_url, occurred_at")
    .eq("opportunity_id", opportunityId)
    .order("occurred_at", { ascending: false });
  return data ?? [];
}

// Anexo (foto ou qualquer arquivo) na linha do tempo da oportunidade —
// mesmo padrão já usado em Demandas (demanda-attachments): sobe pro
// Storage, guarda só o caminho em crm_activities.file_url (bucket
// privado, URL assinada só na hora de exibir).
const MAX_CRM_ATTACHMENT_SIZE = 15 * 1024 * 1024;

export async function addActivityFile(opportunityId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo." };
  if (file.size > MAX_CRM_ATTACHMENT_SIZE) return { error: "Arquivo acima de 15MB." };

  const supabase = await createClient();
  const ext = file.name.split(".").pop();
  const access = await getAccessContext();
  if (!access.workspaceId) return { error: "Sessão expirada. Entre de novo." };
  // Primeira pasta = conta (a policy do Storage confere isso).
  const path = `${access.workspaceId}/${opportunityId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("crm-attachments")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: `Falha ao enviar arquivo: ${uploadError.message}` };

  const { error } = await supabase.from("crm_activities").insert({
    opportunity_id: opportunityId,
    type: "arquivo",
    content: file.name,
    file_url: path,
  });
  if (error) return { error: error.message };

  revalidatePath("/crm/funil");
  return {};
}

export async function getActivityFileSignedUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("crm-attachments")
    .createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}
