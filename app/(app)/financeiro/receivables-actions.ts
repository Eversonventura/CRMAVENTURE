"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext, getCurrentUser } from "@/lib/access";
import { insertSale, type InstallmentInput } from "./receivables-lib";

type Result = { error?: string };


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireFullAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Sessão expirada. Entre de novo.";
  const access = await getAccessContext();
  return access.isFullAdmin ? null : "Só administradores controlam pagamentos.";
}

function refresh() {
  revalidatePath("/crm/propostas");
  revalidatePath("/crm/visao-geral");
}

function validateInstallments(list: InstallmentInput[]): string | null {
  if (list.length === 0) return "Informe ao menos uma parcela.";
  if (list.length > 36) return "No máximo 36 parcelas.";
  for (const [i, p] of list.entries()) {
    if (!Number.isFinite(p.amount) || p.amount <= 0) return `Parcela ${i + 1}: valor inválido.`;
    if (!DATE_RE.test(p.dueDate)) return `Parcela ${i + 1}: data inválida.`;
  }
  return null;
}

// Define como a venda fechada será paga.
//  - recorrencia: grava mensalidade/vencimento/início no cadastro do cliente e
//    cria a 1ª mensalidade como parcela a receber. Só a PRIMEIRA conta como
//    dinheiro novo (regra aplicada na Visão geral).
//  - projeto: cria as parcelas (à vista = 1 parcela). Cada parcela conta no
//    mês em que for recebida.
export async function defineDealPayment(args: {
  opportunityId: string;
  type: "recorrencia" | "projeto";
  description: string;
  monthly?: { value: number; dueDay: number; startDate: string };
  // 1ª mensalidade com pagamento personalizado (ex.: 50% agora + 50% dia 1º).
  // Sem isso, vira uma parcela única na data de início.
  firstInstallments?: InstallmentInput[];
  installments?: InstallmentInput[];
}): Promise<Result> {
  const denied = await requireFullAdmin();
  if (denied) return { error: denied };
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("crm_opportunities")
    .select("id, won_client_id, payment_defined_at")
    .eq("id", args.opportunityId)
    .single();
  if (!opp) return { error: "Oportunidade não encontrada." };
  if (opp.payment_defined_at) return { error: "O pagamento dessa venda já foi definido." };
  if (!opp.won_client_id) return { error: "Essa venda ainda não tem cliente vinculado (feche a oportunidade primeiro)." };

  if (args.type === "recorrencia") {
    const m = args.monthly;
    if (!m || !(m.value > 0)) return { error: "Informe o valor da mensalidade." };
    if (!Number.isInteger(m.dueDay) || m.dueDay < 1 || m.dueDay > 31) return { error: "Dia de vencimento: de 1 a 31." };
    if (!DATE_RE.test(m.startDate)) return { error: "Data de início inválida." };
    const { error } = await supabase
      .from("clients")
      .update({ monthly_value: m.value, payment_due_day: m.dueDay, contract_start_date: m.startDate })
      .eq("id", opp.won_client_id);
    if (error) return { error: error.message };
    // Sem plano personalizado, a 1ª mensalidade vira uma parcela única na data de início.
    const firstInstallments =
      args.firstInstallments && args.firstInstallments.length > 0
        ? args.firstInstallments
        : [{ amount: m.value, dueDate: m.startDate, paid: false }];
    const invalidFirst = validateInstallments(firstInstallments);
    if (invalidFirst) return { error: invalidFirst };
    const sale = await insertSale({
      kind: "primeira_mensalidade",
      clientId: opp.won_client_id,
      opportunityId: opp.id,
      description: args.description.trim() || "Primeira mensalidade",
      installments: firstInstallments,
    });
    if (sale.error) return sale;
  } else {
    const invalid = validateInstallments(args.installments ?? []);
    if (invalid) return { error: invalid };
    const sale = await insertSale({
      kind: "projeto",
      clientId: opp.won_client_id,
      opportunityId: opp.id,
      description: args.description.trim() || "Projeto",
      installments: args.installments!,
    });
    if (sale.error) return sale;
  }

  const { error: markError } = await supabase
    .from("crm_opportunities")
    .update({ deal_type: args.type, payment_defined_at: new Date().toISOString() })
    .eq("id", opp.id);
  if (markError) return { error: markError.message };
  refresh();
  return {};
}
