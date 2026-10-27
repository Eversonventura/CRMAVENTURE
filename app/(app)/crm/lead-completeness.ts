// Quanto o lead está completo. Mínimo exigido: WhatsApp (ou telefone, que
// também abre conversa) E Instagram. Site, Google Meu Negócio e endereço
// (CEP) são desejáveis, mas não definem "incompleto".
export type LeadFields = {
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  googleBusinessUrl: string | null;
  postalCode: string | null;
};

const filled = (v: string | null | undefined) => !!v && v.trim() !== "";

export function leadGaps(f: LeadFields) {
  const missingRequired: string[] = [];
  if (!filled(f.whatsapp) && !filled(f.phone)) missingRequired.push("WhatsApp");
  if (!filled(f.instagram)) missingRequired.push("Instagram");

  const missingOptional: string[] = [];
  if (!filled(f.googleBusinessUrl)) missingOptional.push("Google Meu Negócio");
  if (!filled(f.website)) missingOptional.push("Site");
  if (!filled(f.postalCode)) missingOptional.push("Endereço/CEP");

  return { missingRequired, missingOptional, incomplete: missingRequired.length > 0 };
}
