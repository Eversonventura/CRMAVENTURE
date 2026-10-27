import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/access";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? "/crm/diario" : "/login");
}
