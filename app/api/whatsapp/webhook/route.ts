import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractMessages, isValidSignature, type IncomingMessage } from "@/lib/whatsapp";
import { planOnStageChange, type FollowupRule } from "@/app/(app)/crm/followup-plan";

// Webhook da WhatsApp Cloud API (Meta). Só recebe e cadastra leads: quem responde ao lead é o vendedor,
// pelo WhatsApp Business, e a cadência continua manual no Diário.
// Segredos (variáveis de ambiente do servidor): WHATSAPP_VERIFY_TOKEN e WHATSAPP_APP_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: verificação da Callback URL no painel da Meta.
export async function GET(request: NextRequest) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const params = request.nextUrl.searchParams;
  if (token && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === token) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type IngestResult = {
  status: "created" | "existing_open" | "duplicate" | "unmapped" | "invalid" | "no_stage";
  workspace_id?: string;
  opportunity_id?: string;
  stage_id?: string;
};

// Card novo: agenda o follow-up da etapa de entrada, como o cadastro manual faz (se a conta tiver regra nessa etapa).
async function scheduleEntryFollowup(db: ReturnType<typeof createServiceClient>, r: IngestResult) {
  if (!r.workspace_id || !r.opportunity_id || !r.stage_id) return;
  const { data: rule } = await db
    .from("crm_followup_rules")
    .select("id, stage_id, task_type, interval_days, repeat, daily_goal, active")
    .eq("stage_id", r.stage_id)
    .maybeSingle();
  const plan = planOnStageChange({ toStageId: r.stage_id, rule: (rule as FollowupRule | null) ?? null, pending: [], opportunityOpen: true, now: new Date() });
  if (!plan.create) return;
  await db.from("crm_tasks").insert({
    workspace_id: r.workspace_id,
    opportunity_id: r.opportunity_id,
    type: plan.create.type,
    due_at: plan.create.dueAt.toISOString(),
    source: "followup",
    stage_id: r.stage_id,
    description: "Follow-up automático da etapa de entrada.",
  });
}

async function ingest(db: ReturnType<typeof createServiceClient>, m: IncomingMessage) {
  const { data, error } = await db.rpc("crm_whatsapp_ingest", {
    p_phone_number_id: m.phoneNumberId,
    p_wamid: m.wamid,
    p_wa_id: m.waId,
    p_phone: m.phone,
    p_profile_name: m.profileName,
    p_has_ad: m.hasAd,
    p_ad_id: m.adId,
  });
  if (error) throw new Error(error.message);
  const result = data as IngestResult;
  if (result.status === "created") {
    // O lead já está salvo; falha no agendamento do follow-up não pode reabrir o processamento (reenvio da Meta).
    try {
      await scheduleEntryFollowup(db, result);
    } catch (e) {
      console.error("whatsapp: follow-up da etapa de entrada não agendado:", e instanceof Error ? e.message : e);
    }
  }
  return result;
}

// POST: eventos da Meta. A assinatura é conferida sobre o CORPO BRUTO antes de qualquer processamento.
export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new NextResponse("Webhook não configurado", { status: 503 });

  const raw = await request.text();
  if (!isValidSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Assinatura inválida", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("JSON inválido", { status: 400 });
  }

  // Eventos de status (entregue/lida) não têm mensagens: nada a fazer, mas a Meta precisa do 200.
  const messages = extractMessages(payload);
  if (messages.length === 0) return NextResponse.json({ ok: true, ignored: true });

  const db = createServiceClient();
  try {
    for (const m of messages) {
      const result = await ingest(db, m);
      if (result.status === "unmapped") console.warn("whatsapp: número comercial não mapeado:", m.phoneNumberId);
      if (result.status === "no_stage") console.error("whatsapp: conta sem etapa de entrada (papel Lead) no fluxo configurado");
    }
  } catch (e) {
    // Falha no banco: responde erro para a Meta tentar de novo (a gravação é idempotente).
    console.error("whatsapp: falha ao gravar o lead:", e instanceof Error ? e.message : e);
    return new NextResponse("Erro ao processar", { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
