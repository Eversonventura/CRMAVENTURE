import { redirect } from "next/navigation";

// Relatórios foi unificado com a Visão geral (sprint 185).
export default function CrmRelatoriosPage() {
  redirect("/crm/visao-geral");
}
