"use client";

import { useState } from "react";
import { ClosedDealModal } from "../funil/ClosedDealModal";

// Venda fechada sem plano de pagamento: abre o mesmo modal do fechamento.
export function DefinePaymentButton({
  opportunityId,
  companyName,
  defaultValue,
}: {
  opportunityId: string;
  companyName: string;
  defaultValue: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-brand px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-soft">
        Definir pagamento
      </button>
      {open && (
        <ClosedDealModal opportunityId={opportunityId} companyName={companyName} defaultValue={defaultValue} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
