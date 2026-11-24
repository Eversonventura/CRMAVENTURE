// Testes da lógica do webhook do WhatsApp. Rodar: npx esbuild lib/whatsapp.test.ts --bundle --platform=node --outfile=/tmp/wa-test.js && node --test /tmp/wa-test.js
import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { extractMessages, isValidSignature } from "./whatsapp";

const SECRET = "app-secret-de-teste";
const sign = (body: string, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

const wrap = (value: object) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });
const meta = { display_phone_number: "558532000000", phone_number_id: "PN1" };

test("assinatura: válida, inválida, ausente e formato errado", () => {
  const body = JSON.stringify(wrap({ metadata: meta }));
  assert.equal(isValidSignature(body, sign(body), SECRET), true);
  assert.equal(isValidSignature(body, sign(body, "outro-segredo"), SECRET), false);
  assert.equal(isValidSignature(body + " ", sign(body), SECRET), false, "corpo alterado");
  assert.equal(isValidSignature(body, null, SECRET), false);
  assert.equal(isValidSignature(body, "sha256=zzz", SECRET), false);
  assert.equal(isValidSignature(body, sign(body), ""), false, "sem segredo configurado");
});

test("mensagem de texto: número comercial, contato, telefone e nome", () => {
  const msgs = extractMessages(
    wrap({
      metadata: meta,
      contacts: [{ profile: { name: "Maria Souza" }, wa_id: "5585999990002" }],
      messages: [{ from: "5585999990002", id: "wamid.A", timestamp: "1", type: "text", text: { body: "Oi" } }],
    })
  );
  assert.deepEqual(msgs, [{ phoneNumberId: "PN1", wamid: "wamid.A", waId: "5585999990002", phone: "5585999990002", profileName: "Maria Souza", hasAd: false, adId: null }]);
});

test("evento de status (entregue/lida) é ignorado", () => {
  const msgs = extractMessages(wrap({ metadata: meta, statuses: [{ id: "wamid.S", status: "delivered", recipient_id: "5585999990002" }] }));
  assert.equal(msgs.length, 0);
});

test("reação não cadastra lead", () => {
  const msgs = extractMessages(wrap({ metadata: meta, contacts: [{ profile: { name: "X" }, wa_id: "5585999990002" }], messages: [{ from: "5585999990002", id: "wamid.R", type: "reaction" }] }));
  assert.equal(msgs.length, 0);
});

test("anúncio: referral guarda o id do anúncio", () => {
  const msgs = extractMessages(
    wrap({
      metadata: meta,
      contacts: [{ profile: { name: "Ana" }, wa_id: "5585999990008" }],
      messages: [{ from: "5585999990008", id: "wamid.AD", type: "text", referral: { source_type: "ad", source_id: "120200000000", source_url: "https://fb.me/x", headline: "Oferta" } }],
    })
  );
  assert.equal(msgs[0].hasAd, true);
  assert.equal(msgs[0].adId, "120200000000");
});

test("referral de post (não anúncio) não vira Meta Ads", () => {
  const msgs = extractMessages(wrap({ metadata: meta, contacts: [{ wa_id: "5585999990009" }], messages: [{ from: "5585999990009", id: "wamid.P", type: "text", referral: { source_type: "post", source_id: "999" } }] }));
  assert.equal(msgs[0].hasAd, false);
  assert.equal(msgs[0].adId, null);
});

test("sem referral: origem de anúncio sem atribuição", () => {
  const msgs = extractMessages(wrap({ metadata: meta, contacts: [{ wa_id: "5585999990010" }], messages: [{ from: "5585999990010", id: "wamid.N", type: "text" }] }));
  assert.equal(msgs[0].hasAd, false);
  assert.equal(msgs[0].adId, null);
});

test("telefone oculto: usa o identificador e deixa o telefone pendente", () => {
  const msgs = extractMessages(wrap({ metadata: meta, contacts: [{ profile: { name: "Lia" }, user_id: "BR.1349120865" }], messages: [{ from_user_id: "BR.1349120865", id: "wamid.H", type: "text" }] }));
  assert.equal(msgs[0].waId, "BR.1349120865");
  assert.equal(msgs[0].phone, null);
  assert.equal(msgs[0].profileName, "Lia");
});

test("várias mensagens e payload estranho", () => {
  const two = extractMessages(wrap({ metadata: meta, contacts: [{ wa_id: "5585999990011" }], messages: [{ from: "5585999990011", id: "a", type: "text" }, { from: "5585999990011", id: "b", type: "image" }] }));
  assert.equal(two.length, 2);
  assert.deepEqual(extractMessages(null), []);
  assert.deepEqual(extractMessages({ entry: "x" }), []);
  assert.deepEqual(extractMessages({ entry: [{ changes: [{ field: "other", value: {} }] }] }), []);
});
