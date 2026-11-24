// Webhook do WhatsApp (Cloud API oficial): validação da assinatura e leitura das mensagens recebidas.
// Lógica pura (sem rede nem banco) para poder testar sem a Meta.
import { createHmac, timingSafeEqual } from "node:crypto";

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256 do CORPO BRUTO com o App Secret da Meta.
export function isValidSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(match[1], "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export type IncomingMessage = {
  phoneNumberId: string; // número comercial que recebeu (identifica a empresa)
  wamid: string; // id da mensagem (evita duplicar em reenvios)
  waId: string | null; // identificador do contato (número ou identificador opaco)
  phone: string | null; // telefone, quando vier
  profileName: string | null;
  hasAd: boolean; // a mensagem veio de um anúncio
  adId: string | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Extrai só as MENSAGENS recebidas. Eventos de status (entregue/lida) e reações são ignorados.
export function extractMessages(payload: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  if (!isRecord(payload)) return out;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = isRecord(entry) && Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      const value = change.value;
      const phoneNumberId = isRecord(value.metadata) ? str(value.metadata.phone_number_id) : null;
      if (!phoneNumberId) continue;
      const contacts = Array.isArray(value.contacts) ? value.contacts.filter(isRecord) : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        if (!isRecord(message)) continue;
        const wamid = str(message.id);
        if (!wamid || message.type === "reaction") continue;
        const from = str(message.from) ?? str(message.from_user_id);
        // O contato da mensagem: o que tem o mesmo identificador (ou o único da lista).
        const contact =
          contacts.find((c) => from && (str(c.wa_id) === from || str(c.user_id) === from)) ?? (contacts.length === 1 ? contacts[0] : undefined);
        const waId = str(contact?.wa_id) ?? str(contact?.user_id) ?? from;
        const digitsOnly = (v: string | null) => (v && /^\+?\d{8,15}$/.test(v) ? v.replace(/\D/g, "") : null);
        const phone = digitsOnly(str(contact?.wa_id)) ?? digitsOnly(from);
        const profile = contact && isRecord(contact.profile) ? str(contact.profile.name) : null;
        const referral = isRecord(message.referral) ? message.referral : null;
        const hasAd = !!referral && (referral.source_type === undefined || referral.source_type === "ad");
        out.push({
          phoneNumberId,
          wamid,
          waId,
          phone,
          profileName: profile,
          hasAd,
          adId: hasAd ? str(referral?.source_id) : null,
        });
      }
    }
  }
  return out;
}
