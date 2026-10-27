export type CrmRole = "administrador" | "gestor" | "vendedor";

export type Temperature = "frio" | "morno" | "quente";

export const TEMPERATURE_LABELS: Record<Temperature, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

export type OpportunityStatus = "aberta" | "fechada" | "perdida";

export const ACQUISITION_CHANNELS = [
  "Prospecção ativa",
  "Indicação passiva",
  "Indicação ativa",
  "Tráfego pago",
  "Orgânico — redes sociais",
  "Orgânico — site",
  "Cliente atual",
  "Parceiro",
  "Evento",
  "Outro",
] as const;

export const LOSS_REASONS = [
  "Sem orçamento",
  "Preço",
  "Sem prioridade",
  "Não respondeu",
  "Escolheu concorrente",
  "Decisão interna",
  "Serviço não adequado",
  "Não é o momento",
  "Projeto cancelado",
  "Sem autoridade pra decidir",
  "Outro",
] as const;

// `kind` e `role` existem pra que a lógica (automações, Diário, Fechado/
// Perdido) nunca dependa do NOME da etapa — o usuário pode renomear à
// vontade. kind: o que a etapa representa no ciclo (aberta/ganha/perdida);
// role: o papel da etapa nos blocos do Diário e nas regras de follow-up
// (várias etapas podem ter o mesmo role; null = sem papel especial).
export type StageKind = "open" | "won" | "lost";
export type StageRole =
  | "lead"
  | "tentativa"
  | "contato"
  | "briefing"
  | "diagnostico_proposta"
  | "negociacao"
  | "standby";

export const STAGE_KIND_LABELS: Record<StageKind, string> = {
  open: "Em andamento",
  won: "Fechado (ganho)",
  lost: "Perdido",
};

export const STAGE_ROLE_LABELS: Record<StageRole, string> = {
  lead: "Novo lead",
  tentativa: "Tentativa de contato",
  contato: "Contato realizado",
  briefing: "Pré-briefing",
  diagnostico_proposta: "Diagnóstico / proposta apresentada",
  negociacao: "Negociação",
  standby: "Stand-by (aquecimento)",
};

export type CrmStage = {
  id: string;
  name: string;
  position: number;
  color: string;
  pipeline_id: string;
  kind: StageKind;
  role: StageRole | null;
};

// Paleta ampliada (16 cores) — além dela, o seletor aceita qualquer cor
// escolhida no seletor nativo (hex livre).
export const STAGE_COLOR_PRESETS = [
  "#FF007A",
  "#F43F5E",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#D946EF",
  "#A16207",
  "#64748B",
  "#0F172A",
];

export type CrmCompany = {
  id: string;
  name: string;
  website: string | null;
  segment: string | null;
  city: string | null;
  employee_count: string | null;
  social_links: Record<string, string>;
  approx_revenue: string | null;
  internal_notes: string | null;
  created_at: string;
};

export type CrmContact = {
  id: string;
  company_id: string;
  name: string;
  role_title: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  contact_preference: string | null;
  created_at: string;
};

export type TaskType =
  | "ligar"
  | "whatsapp"
  | "email"
  | "pesquisa"
  | "agendar_reuniao"
  | "realizar_reuniao"
  | "preparar_diagnostico"
  | "preparar_proposta"
  | "follow_up"
  | "solicitar_indicacao";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  ligar: "Ligar",
  whatsapp: "Enviar WhatsApp",
  email: "Enviar e-mail",
  pesquisa: "Pesquisar",
  agendar_reuniao: "Agendar reunião",
  realizar_reuniao: "Realizar reunião",
  preparar_diagnostico: "Preparar diagnóstico",
  preparar_proposta: "Preparar proposta",
  follow_up: "Follow-up",
  solicitar_indicacao: "Solicitar indicação",
};

export type TaskStatus = "pendente" | "concluida" | "cancelada";

export type CrmTask = {
  id: string;
  opportunity_id: string;
  type: TaskType;
  responsible_id: string | null;
  due_at: string;
  priority: string | null;
  description: string | null;
  status: TaskStatus;
  activity_result: string | null;
  created_at: string;
  source: "manual" | "followup" | "cadence";
  stage_id: string | null;
  stageName: string | null;
  companyName: string;
  responsibleName: string | null;
};

export type CrmProposal = {
  id: string;
  opportunity_id: string;
  presented_at: string | null;
  value: number | null;
  validity_date: string | null;
  decision_makers: string | null;
  objections: string | null;
  agreed_response_date: string | null;
  next_contact_date: string | null;
  pdf_url: string | null;
  created_at: string;
  companyName: string;
};

export type TeamMemberOption = {
  id: string;
  full_name: string;
  photo_url: string | null;
};

export type CrmOpportunity = {
  id: string;
  company_id: string;
  contact_id: string | null;
  service_interest: string | null;
  estimated_value: number | null;
  close_probability: number | null;
  expected_close_date: string | null;
  responsible_id: string | null;
  stage_id: string;
  temperature: Temperature | null;
  priority: string | null;
  search_reason: string | null;
  main_problem: string | null;
  desired_objective: string | null;
  available_budget: string | null;
  decision_maker: string | null;
  start_deadline: string | null;
  acquisition_channel: string | null;
  campaign: string | null;
  ad: string | null;
  form_name: string | null;
  landing_page: string | null;
  referred_by: string | null;
  referral_related_client: string | null;
  referral_type: string | null;
  referral_date: string | null;
  referral_result: string | null;
  ad_platform: string | null;
  ad_set: string | null;
  keyword: string | null;
  first_touch_channel: string | null;
  last_touch_channel: string | null;
  entered_at: string;
  rescue_status: string | null;
  in_nurturing: boolean;
  nurturing_return_date: string | null;
  status: OpportunityStatus;
  loss_reason: string | null;
  loss_details: string | null;
  won_client_id: string | null;
  created_at: string;
  // campos resolvidos (join) pra exibição
  companyName: string;
  contactName: string | null;
  responsibleName: string | null;
  responsiblePhoto: string | null;
};
