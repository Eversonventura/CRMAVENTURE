// Meta olímpica = VENDAS FECHADAS no mês (independente da forma de pagamento),
// não o que foi recebido. Ex.: projeto de R$ 5.550 com sinal de R$ 3.000 conta os
// R$ 5.550 no mês em que foi fechado; uma venda de agosto parcelada não conta em
// outubro só porque a parcela caiu em outubro. Lógica pura, testável por script.
// (Regra trazida do Aventure Hub; sem os serviços pontuais, que só existem lá.)
import { brtDateOf } from "./diario/off-days";

export type SaleSource = "crm" | "servico" | "comissao";
export type SaleEntry = { key: string; source: SaleSource; label: string; client: string; value: number; date: string };

export type ClosedOpp = {
  id: string;
  company: string;
  value: number | null;
  // Mensalidade definida no fechamento (recorrência), guardada no cadastro do cliente.
  monthlyValue?: number | null;
  isRecurring?: boolean;
  closedAt: string;
};
export type ReceivableSale = {
  saleId: string;
  kind: string; // projeto | comissao | primeira_mensalidade
  opportunityId: string | null;
  clientName: string | null;
  description: string;
  saleTotal: number;
  firstDue: string; // menor vencimento das parcelas (AAAA-MM-DD)
};

export function monthlySales(args: {
  month: string; // AAAA-MM
  closedOpps: ClosedOpp[];
  receivableSales: ReceivableSale[];
}): SaleEntry[] {
  const { month } = args;
  const entries: SaleEntry[] = [];
  const planByOpp = new Map<string, ReceivableSale>();
  for (const s of args.receivableSales) {
    if (s.opportunityId && s.kind === "projeto") planByOpp.set(s.opportunityId, s);
  }

  // 1) Negócios fechados no CRM: valor da VENDA — o do plano de projeto, se foi
  //    definido; em recorrência, a mensalidade definida no fechamento (desconto na
  //    1ª mensalidade é caixa, não muda a venda); senão o valor estimado.
  for (const o of args.closedOpps) {
    const date = brtDateOf(o.closedAt);
    if (date.slice(0, 7) !== month) continue;
    const monthly = o.monthlyValue && o.monthlyValue > 0 ? o.monthlyValue : null;
    const value = planByOpp.get(o.id)?.saleTotal ?? (o.isRecurring ? monthly : null) ?? o.value ?? monthly ?? 0;
    if (value <= 0) continue;
    entries.push({ key: `opp-${o.id}`, source: "crm", label: "Fechamento no CRM", client: o.company, value, date });
  }

  // 2) Vendas lançadas direto em Recebimentos (venda avulsa / comissão). As
  //    ligadas a uma oportunidade já entraram no item 1; a data é a do primeiro vencimento.
  for (const s of args.receivableSales) {
    if (s.opportunityId) continue;
    if (s.kind === "primeira_mensalidade") continue; // sempre vem de uma oportunidade
    if (s.firstDue.slice(0, 7) !== month) continue;
    entries.push({
      key: `sale-${s.saleId}`,
      source: s.kind === "comissao" ? "comissao" : "servico",
      label: s.kind === "comissao" ? "Comissão de fornecedor" : "Venda avulsa",
      client: s.clientName ?? s.description,
      value: s.saleTotal,
      date: s.firstDue,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// Contratos fechados no mês: fechamentos do CRM e vendas avulsas (comissão não é contrato).
export const isContract = (e: SaleEntry) => e.source === "crm" || e.source === "servico";
