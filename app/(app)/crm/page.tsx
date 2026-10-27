import { redirect } from "next/navigation";

// A primeira tela do CRM é o Diário; a Visão geral fica em /crm/visao-geral.
export default function CrmIndexPage() {
  redirect("/crm/diario");
}
