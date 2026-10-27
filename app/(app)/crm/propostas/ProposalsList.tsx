import type { CrmProposal } from "../types";

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

// Histórico das propostas cadastradas à mão antes da sincronização com o
// funil — só leitura (os PDFs continuam acessíveis).
export function ProposalsList({ proposals }: { proposals: CrmProposal[] }) {
  return (
    <div>
      {proposals.length === 0 ? null : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-normal">Empresa</th>
                <th className="px-4 py-3 font-normal">Valor</th>
                <th className="px-4 py-3 font-normal">Apresentada em</th>
                <th className="px-4 py-3 font-normal">Validade</th>
                <th className="px-4 py-3 font-normal">PDF</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink">{p.companyName}</td>
                  <td className="px-4 py-3 text-ink">{formatCurrency(p.value)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(p.presented_at)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(p.validity_date)}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/crm/propostas/${p.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:opacity-80"
                    >
                      Gerar PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
