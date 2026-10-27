// Compartilhado entre telas do CRM que mostram WhatsApp/Instagram como
// link clicável (Contatos e, agora, o pop-up de oportunidade do
// Funil) — funções puras, sem dependência de servidor, pra poder ser
// importado de componente client também.

// wa.me só aceita dígitos — limpa qualquer formatação (parênteses,
// espaço, traço) do número guardado.
export function whatsappLink(value: string) {
  const digits = value.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

// O valor guardado pode vir como "@usuario", "usuario" ou já uma URL
// completa (import antigo, digitação manual) — normaliza pra sempre
// virar um link de verdade pro perfil.
export function instagramLink(value: string) {
  if (value.startsWith("http")) return value;
  const handle = value.replace(/^@/, "").trim();
  return `https://instagram.com/${handle}`;
}
