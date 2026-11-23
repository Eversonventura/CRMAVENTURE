// Modelos de mensagem sugeridos no card do lead. Funções puras (usadas no servidor e no navegador).
export type MessageKind = "tentativa" | "follow_up" | "indicacao" | "outro";

export const MESSAGE_KINDS: { kind: MessageKind; label: string; hint: string }[] = [
  { kind: "tentativa", label: "Tentativa de contato", hint: "primeira abordagem e retomadas quando o lead ainda não respondeu" },
  { kind: "follow_up", label: "Follow-up", hint: "acompanhar quem já conversou, ou recebeu proposta" },
  { kind: "indicacao", label: "Indicação", hint: "pedir que o cliente indique outras pessoas" },
  { kind: "outro", label: "Outras mensagens", hint: "agradecimento, aviso, o que fizer sentido para o seu time" },
];

export const MESSAGE_VARIABLES = [
  { token: "{nome}", hint: "primeiro nome do contato" },
  { token: "{empresa}", hint: "nome da empresa (em B2C, o próprio contato)" },
  { token: "{vendedor}", hint: "quem está enviando (seu nome)" },
] as const;

export type MessageTemplate = { id: string; kind: MessageKind; title: string; body: string; position: number; active: boolean };

const firstName = (value: string) => value.trim().split(/\s+/)[0] ?? "";

// Troca as variáveis pelos dados do lead. Variável sem dado vira vazio e o espaço sobrante é arrumado.
export function fillTemplate(body: string, vars: { contact: string | null; company: string; seller: string | null }): string {
  // Sem nome de contato, usa o nome inteiro da empresa ("Olá, Clínica Sorriso!"), não só a primeira palavra.
  const name = vars.contact?.trim() ? firstName(vars.contact) : vars.company.trim();
  return body
    .replaceAll("{nome}", name)
    .replaceAll("{empresa}", vars.company)
    .replaceAll("{vendedor}", vars.seller?.trim() ?? "")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Que tipo de mensagem faz sentido sugerir primeiro, pela etapa do lead.
export function suggestedKind(stageRole: string | null | undefined): MessageKind {
  if (!stageRole || stageRole === "lead" || stageRole === "tentativa") return "tentativa";
  return "follow_up";
}
