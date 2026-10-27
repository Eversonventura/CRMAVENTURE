import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProposalsList } from "./ProposalsList";
import { ValueCell } from "./ValueCell";
import { DefinePaymentButton } from "./DefinePaymentButton";
import type { CrmProposal, TeamMemberOption } from "../types";

// Propostas = visão das oportunidades do funil (nada é cadastrado aqui):
//   Em negociação → abertas nas etapas de diagnóstico/proposta e negociação
//   Fechadas / Perdidas → pelo closed_at / lost_at, dentro do período.

const PERIODS: Record<string, { label: string; days: number | "month" | null }> = {
  mes: { label: "Este mês", days: "month" },
  "30": { label: "30 dias", days: 30 },
  "90": { label: "90 dias", days: 90 },
  ano: { label: "12 meses", days: 365 },
  tudo: { label: "Tudo", days: null },
};

const VIEWS = {
  abertas: "Em negociação",
  fechadas: "Fechadas",
  perdidas: "Perdidas",
} as const;
type View = keyof typeof VIEWS;

function periodStart(key: string): string | null {
  const days = PERIODS[key]?.days;
  const now = new Date();
  if (days === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (typeof days === "number") return new Date(now.getTime() - days * 86400000).toISOString();
  return null;
}

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "—";
}

type Row = {
  id: string;
  estimated_value: number | null;
  responsible_id: string | null;
  entered_at: string;
  closed_at: string | null;
  lost_at: string | null;
  loss_reason: string | null;
  deal_type: string | null;
  payment_defined_at: string | null;
  crm_companies: { name: string } | { name: string }[] | null;
  crm_stages: { name: string; color: string | null; role: string | null } | { name: string; color: string | null; role: string | null }[] | null;
};

const SELECT =
  "id, estimated_value, responsible_id, entered_at, closed_at, lost_at, loss_reason, deal_type, payment_defined_at, crm_companies(name), crm_stages!inner(name, color, role)";

export default async function CrmPropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; periodo?: string }>;
}) {
  const sp = await searchParams;
  const view: View = sp.visao && sp.visao in VIEWS ? (sp.visao as View) : "abertas";
  const periodo = sp.periodo && sp.periodo in PERIODS ? sp.periodo : "mes";
  const since = periodStart(periodo);

  const supabase = await createClient();

  const base = supabase.from("crm_opportunities").select(SELECT).limit(500);
  const query =
    view === "abertas"
      ? base.eq("status", "aberta").in("crm_stages.role", ["diagnostico_proposta", "negociacao"]).order("entered_at", { ascending: false })
      : view === "fechadas"
        ? (since ? base.eq("status", "fechada").gte("closed_at", since) : base.eq("status", "fechada")).order("closed_at", { ascending: false })
        : (since ? base.eq("status", "perdida").gte("lost_at", since) : base.eq("status", "perdida")).order("lost_at", { ascending: false });

  const [{ data }, { data: teamMembers }, { data: legacy }] = await Promise.all([
    query,
    supabase.rpc("team_member_picker_options"),
    supabase
      .from("crm_proposals")
      .select("id, opportunity_id, presented_at, value, validity_date, decision_makers, objections, agreed_response_date, next_contact_date, pdf_url, created_at, crm_opportunities(crm_companies(name))")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const members = new Map(((teamMembers as TeamMemberOption[] | null) ?? []).map((m) => [m.id, m.full_name]));
  const rows = ((data as unknown as Row[]) ?? []).map((o) => {
    const company = Array.isArray(o.crm_companies) ? o.crm_companies[0] : o.crm_companies;
    const stage = Array.isArray(o.crm_stages) ? o.crm_stages[0] : o.crm_stages;
    return { ...o, companyName: company?.name ?? "—", stage };
  });
  const total = rows.reduce((sum, r) => sum + (r.estimated_value ?? 0), 0);

  type RawLegacy = Omit<CrmProposal, "companyName"> & {
    crm_opportunities: { crm_companies: { name: string } | { name: string }[] | null } | { crm_companies: { name: string } | { name: string }[] | null }[] | null;
  };
  const legacyRows: CrmProposal[] = ((legacy as unknown as RawLegacy[]) ?? []).map((p) => {
    const opp = Array.isArray(p.crm_opportunities) ? p.crm_opportunities[0] : p.crm_opportunities;
    const company = Array.isArray(opp?.crm_companies) ? opp?.crm_companies[0] : opp?.crm_companies;
    const { crm_opportunities, ...rest } = p;
    void crm_opportunities;
    return { ...rest, companyName: company?.name ?? "—" };
  });

  const href = (v: View, p: string) => `/crm/propostas?visao=${v}&periodo=${p}`;
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      active ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-ink"
    }`;
  const dateLabel = view === "abertas" ? "Na etapa desde" : view === "fechadas" ? "Fechada em" : "Perdida em";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link key={v} href={href(v, periodo)} className={pill(v === view)}>
              {VIEWS[v]}
            </Link>
          ))}
        </div>
        {view !== "abertas" && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(PERIODS).map(([key, p]) => (
              <Link key={key} href={href(view, key)} className={pill(key === periodo)}>
                {p.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs text-muted">{VIEWS[view]}</p>
        <p className="mt-1 font-display text-2xl font-medium text-ink">{money(total)}</p>
        <p className="text-xs text-muted">{rows.length} oportunidade(s)</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          Nada por aqui{view === "abertas" ? " — nenhuma oportunidade em diagnóstico, proposta ou negociação." : " nesse período."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-normal">Cliente</th>
                <th className="px-4 py-3 font-normal">Etapa</th>
                <th className="px-4 py-3 font-normal">Valor</th>
                <th className="px-4 py-3 font-normal">Responsável</th>
                <th className="px-4 py-3 font-normal">{dateLabel}</th>
                {view === "perdidas" && <th className="px-4 py-3 font-normal">Motivo</th>}
                {view === "fechadas" && <th className="px-4 py-3 font-normal">Pagamento</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{r.companyName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.stage?.color ?? "#64748B" }} />
                      {r.stage?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ValueCell opportunityId={r.id} value={r.estimated_value} />
                  </td>
                  <td className="px-4 py-3 text-muted">{(r.responsible_id && members.get(r.responsible_id)) || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {fmtDate(view === "abertas" ? r.entered_at : view === "fechadas" ? r.closed_at : r.lost_at)}
                  </td>
                  {view === "perdidas" && <td className="px-4 py-3 text-muted">{r.loss_reason ?? "—"}</td>}
                  {view === "fechadas" && (
                    <td className="px-4 py-3">
                      {r.payment_defined_at ? (
                        <span className="text-xs text-emerald-700">
                          ✓ {r.deal_type === "recorrencia" ? "Recorrência" : "Projeto"} · ver em Recebimentos
                        </span>
                      ) : (
                        <DefinePaymentButton opportunityId={r.id} companyName={r.companyName} defaultValue={r.estimated_value} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {legacyRows.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">
            Histórico de propostas antigas ({legacyRows.length}) — só leitura
          </summary>
          <div className="mt-3">
            <ProposalsList proposals={legacyRows} />
          </div>
        </details>
      )}
    </div>
  );
}
