import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { brtToday } from "../diario/dates";
import { ReceivablesBlock } from "./ReceivablesBlock";
import type { ReceivableRow } from "../../financeiro/types";

type Raw = Omit<ReceivableRow, "companyName"> & {
  clients: { company_name: string } | { company_name: string }[] | null;
};

export default async function RecebimentosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const access = await getAccessContext();
  if (!access.isFullAdmin) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        Só administradores da conta controlam recebimentos.
      </p>
    );
  }

  const currentMonth = brtToday().date.slice(0, 7);
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth;

  const supabase = await createClient();
  const [{ data: rows }, { data: clients }] = await Promise.all([
    supabase
      .from("receivables")
      .select(
        "id, sale_id, kind, client_id, description, sale_total, installment_number, installments_total, amount, due_date, status, paid_at, clients(company_name)"
      )
      .order("due_date")
      .limit(2000),
    supabase.from("clients").select("id, company_name").order("company_name"),
  ]);

  const receivables: ReceivableRow[] = ((rows as unknown as Raw[]) ?? []).map((r) => {
    const { clients: rel, ...rest } = r;
    const client = Array.isArray(rel) ? rel[0] : rel;
    return { ...rest, amount: Number(rest.amount), sale_total: Number(rest.sale_total), companyName: client?.company_name ?? null };
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <form className="flex items-center gap-2 text-sm">
          <label className="text-muted" htmlFor="mes">Mês</label>
          <input
            id="mes"
            type="month"
            name="mes"
            defaultValue={month}
            className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
          <button className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink">Ver</button>
        </form>
      </div>
      <ReceivablesBlock receivables={receivables} month={month} clients={(clients as { id: string; company_name: string }[]) ?? []} />
    </div>
  );
}
