export type ReceivableRow = {
  id: string;
  sale_id: string;
  kind: "projeto" | "comissao" | "primeira_mensalidade";
  client_id: string | null;
  companyName: string | null;
  description: string;
  sale_total: number;
  installment_number: number;
  installments_total: number;
  amount: number;
  due_date: string;
  status: "pending" | "paid";
  paid_at: string | null;
};
