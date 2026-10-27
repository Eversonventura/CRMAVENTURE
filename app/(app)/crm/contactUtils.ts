// Função pura (sem "use server") — arquivos com "use server" só podem
// exportar Server Actions assíncronas, por isso isso não pode morar
// em actions.ts mesmo sendo usado só por eles.

// Bug real: o usuário preenchia telefone/WhatsApp/e-mail/cargo sem
// preencher "Nome do contato" — como crm_contacts.name é obrigatório,
// findOrCreateContact recusava (retornava null) e nada era salvo, em
// silêncio. Se sobrou algum dado de contato mas o nome ficou em
// branco, usa o nome da empresa como contato — melhor que perder o
// número silenciosamente.
export function resolveContactName(formData: FormData, companyName: string): string {
  const typed = ((formData.get("contact_name") as string) || "").trim();
  if (typed) return typed;

  const hasOtherContactData = [
    "contact_role",
    "contact_phone",
    "contact_whatsapp",
    "contact_email",
    "contact_preference",
  ].some((key) => ((formData.get(key) as string) || "").trim());

  return hasOtherContactData ? companyName : "";
}
