// Perfil do negócio da conta (aba Configurações): modelo comercial e segmento.
// Define quais campos aparecem nos formulários de contato e de oportunidade.
export type BusinessModel = "b2b" | "b2c";

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, { title: string; hint: string }> = {
  b2b: { title: "B2B", hint: "vende para empresas (o cliente é uma empresa, com um contato dentro dela)" },
  b2c: { title: "B2C", hint: "vende para pessoas (o cliente é a própria pessoa)" },
};

export const SEGMENTS = [
  { value: "agencia_marketing", label: "Agência de marketing" },
  { value: "industria", label: "Indústria" },
  { value: "fabrica", label: "Fábrica" },
  { value: "servicos", label: "Serviços" },
  { value: "direito", label: "Direito / advocacia" },
  { value: "clinica", label: "Clínica / saúde" },
  { value: "estetica", label: "Estética e beleza" },
  { value: "loja", label: "Loja / varejo" },
  { value: "alimentacao", label: "Restaurante / alimentação" },
  { value: "educacao", label: "Educação / cursos" },
  { value: "imobiliaria", label: "Imobiliária" },
  { value: "construcao", label: "Construção civil" },
  { value: "tecnologia", label: "Tecnologia / software" },
  { value: "contabilidade", label: "Contabilidade / finanças" },
  { value: "outro", label: "Outro" },
] as const;

export const AGENCY_SEGMENT = "agencia_marketing";

// Como a conta mede vendas: por valor (R$) ou por contratos fechados (sem preço). Vem da meta olímpica.
export type SalesMode = "valor" | "contratos";

export type CrmSettings = { businessModel: BusinessModel; segment: string | null; salesMode: SalesMode };

// Conta sem linha de configurações (ainda não definida): B2B sem segmento.
export const DEFAULT_SETTINGS: CrmSettings = { businessModel: "b2b", segment: null, salesMode: "valor" };

// Redes sociais e site da empresa só fazem sentido para agência de marketing (B2B).
export const showCompanyOnlineFields = (s: CrmSettings) => s.businessModel === "b2b" && s.segment === AGENCY_SEGMENT;

export const segmentLabel = (value: string | null) => SEGMENTS.find((s) => s.value === value)?.label ?? null;
