// Canais da abordagem. `type` é o tipo gravado na linha do tempo (a lista de tipos de
// atividade é fixa); Indicação e Evento entram como anotação com o canal no texto.
export const APPROACH_CHANNELS = {
  mensagem: { label: "Mensagem", type: "mensagem" },
  instagram: { label: "Instagram", type: "mensagem" },
  ligacao: { label: "Ligação", type: "ligacao" },
  email: { label: "E-mail", type: "email" },
  presencial: { label: "Presencial", type: "reuniao" },
  indicacao: { label: "Indicação", type: "anotacao" },
  evento: { label: "Evento", type: "anotacao" },
} as const;
export type ApproachChannel = keyof typeof APPROACH_CHANNELS;

