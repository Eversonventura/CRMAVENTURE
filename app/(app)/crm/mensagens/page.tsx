import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import type { MessageTemplate } from "../messages";
import { MessagesManager } from "./MessagesManager";

export default async function MensagensPage() {
  const access = await getAccessContext();
  const supabase = await createClient();
  const { data } = await supabase.from("crm_message_templates").select("id, kind, title, body, position, active").order("position");
  return <MessagesManager templates={(data as MessageTemplate[] | null) ?? []} canEdit={access.isFullAdmin} />;
}
