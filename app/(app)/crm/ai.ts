"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCrmAccessContext } from "./lib";

export type MessageSuggestion = {
  title: string;
  message: string;
};

const SYSTEM_PROMPT = `Você é um assistente de vendas B2B. Sua função é sugerir mensagens de WhatsApp para o vendedor continuar a conversa com um lead do funil comercial, com base no estágio em que ele está e no histórico já registrado no CRM.

Regras:
- Escreva em português do Brasil, tom direto e consultivo, sem "corporativês" nem enrolação. Como se fosse o próprio vendedor escrevendo, não um robô se apresentando.
- Nunca invente informação que não foi dada (número, caso, dado de resultado, preço). Se quiser sugerir mandar um case ou material, descreva o que mandar em vez de inventar o conteúdo.
- Adapte a mensagem ao estágio e ao histórico: lead novo sem contato é diferente de lead que já recebeu proposta e sumiu, que é diferente de quem não fechou por preço ou por falta de confiança.
- Gere sempre 3 sugestões com abordagens diferentes entre si (ex: retomar contato, compartilhar algo de valor, contornar uma objeção específica, oferecer um próximo passo menor), nunca 3 variações da mesma ideia.
- Cada mensagem deve ser curta o suficiente pra WhatsApp (poucas linhas), pronta pra copiar e colar — sem colchetes, sem placeholder tipo "[nome]" (use o nome real do contato se disponível, senão escreva de forma que funcione sem nome).
- Responda chamando a ferramenta "suggest_messages", nada de texto fora dela.`;

function buildContext(opportunity: any, activities: any[]): string {
  const company = opportunity.crm_companies ?? {};
  const contact = opportunity.crm_contacts ?? {};
  const stageName = opportunity.crm_stages?.name ?? "—";

  const lines: string[] = [];
  lines.push(`Estágio atual no funil: ${stageName}`);
  if (opportunity.temperature) lines.push(`Temperatura: ${opportunity.temperature}`);
  if (opportunity.status === "perdida") {
    lines.push(`Oportunidade PERDIDA. Motivo: ${opportunity.loss_reason ?? "não informado"}`);
    if (opportunity.loss_details) lines.push(`Detalhes da perda: ${opportunity.loss_details}`);
  }

  lines.push("");
  lines.push(`Empresa: ${company.name ?? "—"}`);
  if (company.segment) lines.push(`Segmento: ${company.segment}`);
  if (company.website) lines.push(`Site: ${company.website}`);
  if (company.city) lines.push(`Cidade: ${company.city}`);
  if (company.internal_notes) lines.push(`Observações internas: ${company.internal_notes}`);

  if (contact.name) {
    lines.push("");
    lines.push(`Contato: ${contact.name}${contact.role_title ? ` (${contact.role_title})` : ""}`);
  }

  const commercial: [string, string | null][] = [
    ["Serviço de interesse", opportunity.service_interest],
    ["Motivo da busca", opportunity.search_reason],
    ["Principal problema", opportunity.main_problem],
    ["Objetivo desejado", opportunity.desired_objective],
    ["Orçamento disponível", opportunity.available_budget],
    ["Quem decide", opportunity.decision_maker],
    ["Prazo pra começar", opportunity.start_deadline],
    ["Canal de aquisição", opportunity.acquisition_channel],
  ];
  const filled = commercial.filter(([, v]) => v);
  if (filled.length) {
    lines.push("");
    for (const [label, value] of filled) lines.push(`${label}: ${value}`);
  }

  if (activities.length) {
    lines.push("");
    lines.push("Histórico registrado no CRM (mais antigo primeiro):");
    for (const a of activities) {
      const date = new Date(a.occurred_at).toLocaleDateString("pt-BR");
      const label = ACTIVITY_LABELS[a.type] ?? a.type;
      lines.push(`- [${date}] ${label}${a.content ? `: ${a.content}` : ""}`);
    }
  } else {
    lines.push("");
    lines.push("Nenhuma atividade registrada ainda além da criação da oportunidade.");
  }

  return lines.join("\n");
}

const ACTIVITY_LABELS: Record<string, string> = {
  mensagem: "Mensagem enviada",
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  mudanca_etapa: "Mudança de etapa",
  tarefa: "Tarefa",
  anotacao: "Anotação",
  arquivo: "Arquivo enviado",
  proposta: "Proposta",
  motivo_perda: "Motivo de perda",
  automacao: "Automação",
};

export async function suggestCrmMessages(
  opportunityId: string
): Promise<{ suggestions?: MessageSuggestion[]; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "IA não configurada: falta a variável ANTHROPIC_API_KEY no servidor." };
  }

  await getCrmAccessContext();
  const supabase = await createClient();

  const [{ data: opportunity, error: oppError }, { data: activities }] = await Promise.all([
    supabase
      .from("crm_opportunities")
      .select(
        "id, status, temperature, loss_reason, loss_details, service_interest, search_reason, main_problem, desired_objective, available_budget, decision_maker, start_deadline, acquisition_channel, crm_companies(name, website, segment, city, internal_notes), crm_contacts(name, role_title), crm_stages(name)"
      )
      .eq("id", opportunityId)
      .single(),
    supabase
      .from("crm_activities")
      .select("type, content, occurred_at")
      .eq("opportunity_id", opportunityId)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);

  if (oppError || !opportunity) {
    return { error: "Oportunidade não encontrada." };
  }

  const context = buildContext(opportunity, (activities ?? []).slice().reverse());

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
      tools: [
        {
          name: "suggest_messages",
          description: "Envia as 3 sugestões de mensagem geradas.",
          input_schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Nome curto da abordagem, ex: 'Retomar contato', 'Contornar objeção de preço'.",
                    },
                    message: {
                      type: "string",
                      description: "Texto pronto pra copiar e colar no WhatsApp.",
                    },
                  },
                  required: ["title", "message"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "suggest_messages" },
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { error: "A IA não retornou sugestões. Tente novamente." };
    }

    const input = toolUse.input as { suggestions?: MessageSuggestion[] };
    if (!input.suggestions?.length) {
      return { error: "A IA não retornou sugestões. Tente novamente." };
    }

    return { suggestions: input.suggestions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao gerar sugestões." };
  }
}
