"use server";

import { findPipelineStage } from "./stage-lookup";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { getCrmAccessContext } from "./lib";
import { resolveContactName } from "./contactUtils";
import { COMPANY_KEYS, pickContactFields, pickOpportunityFields, pickStrings } from "./form-fields";
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

export async function createOpportunityAction(
  _prevState: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const companyName = (formData.get("company_name") as string)?.trim();
  if (!companyName) return { error: "Nome da empresa é obrigatório." };

  const supabase = await createClient();

  try {
    // Só os campos que o formulário mostrou, e só os preenchidos: criar não apaga
    // dados de uma empresa/contato que já existia com o mesmo nome.
    const companyId = await findOrCreateCompany(supabase, companyName, pickStrings(formData, COMPANY_KEYS, { skipEmpty: true }));

    const contactName = resolveContactName(formData, companyName);
    const contactId = await findOrCreateContact(supabase, companyId, contactName, pickContactFields(formData, { skipEmpty: true }));

    const fields = pickOpportunityFields(formData, { skipEmpty: true });
    const stageId = formData.get("stage_id") as string;
    if (!stageId) return { error: "Selecione a etapa." };
    const channel = (fields.acquisition_channel as string | null | undefined) ?? null;

    const { data: created, error } = await supabase
      .from("crm_opportunities")
      .insert({
        company_id: companyId,
        contact_id: contactId,
        stage_id: stageId,
        first_touch_channel: channel,
        last_touch_channel: channel,
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
      // Só os campos que o formulário mostrou (B2C e segmentos sem redes sociais não têm todos).
      const companyFields = pickStrings(formData, COMPANY_KEYS);
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

      const contactFields = pickContactFields(formData);
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

      const fields = pickOpportunityFields(formData);
      const stageId = formData.get("stage_id") as string;

      const { data: before } = await supabase
        .from("crm_opportunities")
        .select("acquisition_channel, stage_id")
        .eq("id", id)
        .single();

      // first_touch_channel nunca muda depois de gravado; last_touch só
      // atualiza quando o canal informado agora é diferente do anterior.
      const newChannel = "acquisition_channel" in fields ? ((fields.acquisition_channel as string | null) ?? null) : undefined;
      const channelChanged = before && newChannel !== undefined && before.acquisition_channel !== newChannel;

      const { error } = await supabase
        .from("crm_opportunities")
        .update({
          company_id: companyId,
          contact_id: contactId,
          stage_id: stageId,
          ...fields,
          ...(channelChanged ? { last_touch_channel: newChannel } : {}),
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

  // Voltou para uma etapa em andamento: se estava fechada ou perdida (o Funil
  // mostra essas por 3 meses), a oportunidade reabre. O gatilho do banco zera
  // closed_at/lost_at.
  if (toStage?.kind === "open") {
    await supabase
      .from("crm_opportunities")
      .update({ status: "aberta" })
      .eq("id", id)
      .neq("status", "aberta");
  }

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

// Exclui o lead de vez: a oportunidade e, se for a única daquela empresa, a
// empresa e os contatos junto (cascata remove tarefas, histórico, atividades,
// propostas e a lista do Diário). Recebíveis já lançados ficam, só perdem o
// vínculo. Se a empresa ainda tem outra oportunidade, só esta é apagada.
export async function deleteOpportunityAction(opportunityId: string): Promise<{ error?: string; companyKept?: boolean }> {
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("crm_opportunities")
    .select("id, company_id, contact_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return { error: "Lead não encontrado ou sem permissão." };

  const { count } = await supabase
    .from("crm_opportunities")
    .select("id", { count: "exact", head: true })
    .eq("company_id", opp.company_id)
    .neq("id", opp.id);

  // Vendedor só enxerga as próprias oportunidades: não dá para saber se outra
  // pessoa também trabalha com essa empresa. Nesse caso apaga só esta oportunidade
  // e preserva a empresa (e os contatos), para nunca levar embora o lead de outro.
  const { canSeeAll } = await getCrmAccessContext();

  let companyKept = false;
  if ((count ?? 0) === 0 && canSeeAll) {
    const { data, error } = await supabase.from("crm_companies").delete().eq("id", opp.company_id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Sem permissão para excluir este lead." };
  } else {
    companyKept = true;
    const { data, error } = await supabase.from("crm_opportunities").delete().eq("id", opp.id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Sem permissão para excluir este lead." };
  }

  revalidateCrmViews();
  return { companyKept };
}
