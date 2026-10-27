import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/access";

export type InstallmentInput = { amount: number; dueDate: string; paid: boolean };

// Grava as parcelas de uma venda (sale_id agrupa). Usado pelo funil (projeto /
// 1ª mensalidade) e por Recebimentos (venda avulsa, comissão).
export async function insertSale(args: {
  kind: "projeto" | "comissao" | "primeira_mensalidade";
  clientId: string | null;
  opportunityId: string | null;
  description: string;
  method?: string | null;
  saleId?: string;
  installments: InstallmentInput[];
}): Promise<{ error?: string; saleId?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const saleId = args.saleId ?? randomUUID();
  const total = args.installments.reduce((s, p) => s + p.amount, 0);
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("receivables").insert(
    args.installments.map((p, i) => ({
      sale_id: saleId,
      kind: args.kind,
      client_id: args.clientId,
      opportunity_id: args.opportunityId,
      description: args.description,
      method: args.method ?? null,
      sale_total: Math.round(total * 100) / 100,
      installment_number: i + 1,
      installments_total: args.installments.length,
      amount: p.amount,
      due_date: p.dueDate,
      status: p.paid ? "paid" : "pending",
      paid_at: p.paid ? (p.dueDate <= today ? p.dueDate : today) : null,
      created_by: user?.id ?? null,
    }))
  );
  return error ? { error: error.message } : { saleId };
}
