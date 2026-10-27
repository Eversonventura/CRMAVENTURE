import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { ProposalPdfDocument } from "../../ProposalPdfDocument";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("crm_proposals")
    .select(
      "presented_at, value, validity_date, decision_makers, objections, agreed_response_date, crm_opportunities(crm_companies(name))"
    )
    .eq("id", id)
    .single();

  if (!proposal) return new Response("Não encontrada.", { status: 404 });

  const opp = Array.isArray(proposal.crm_opportunities)
    ? proposal.crm_opportunities[0]
    : proposal.crm_opportunities;
  const company = Array.isArray(opp?.crm_companies) ? opp?.crm_companies[0] : opp?.crm_companies;

  const buffer = await renderToBuffer(
    ProposalPdfDocument({
      companyName: company?.name ?? "Cliente",
      presentedAt: proposal.presented_at,
      value: proposal.value,
      validityDate: proposal.validity_date,
      decisionMakers: proposal.decision_makers,
      objections: proposal.objections,
      agreedResponseDate: proposal.agreed_response_date,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
  });
}
