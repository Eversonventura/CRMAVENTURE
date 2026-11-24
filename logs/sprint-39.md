# Sprint 39 — Leads automáticos do WhatsApp (Cloud API oficial)

Pedido: cadastrar automaticamente, no Avante, os leads que mandam a primeira mensagem para o WhatsApp comercial do cliente (contato + card em Novo lead), com a Cloud API oficial, sem n8n.

## O que mudou
- `supabase/migrations/012_whatsapp_leads.sql` (+ `schema.sql`) → `crm_contacts.wa_id`; função `crm_phone_key` (DDD + últimos 8 dígitos: casa "(85) 99690-3413", "+55…" e número sem o 9) e índices; tabela `crm_whatsapp_numbers` (número comercial → conta, fluxo opcional; só a operação cadastra, o administrador da conta lê); tabela `crm_whatsapp_events` (id da mensagem, para não duplicar); função `crm_whatsapp_ingest` (única transação, trava por contato, só `service_role` executa).
- `app/api/whatsapp/webhook/route.ts` → GET (token de verificação → desafio) e POST (assinatura `X-Hub-Signature-256` sobre o corpo bruto antes de processar; status e reações ignorados; erro de banco = 500 para a Meta reenviar; follow-up da etapa de entrada agendado como no cadastro manual).
- `lib/whatsapp.ts` (+ `lib/whatsapp.test.ts`) → validação da assinatura e leitura das mensagens (nome de perfil, telefone ou identificador, anúncio e id do anúncio).
- `lib/supabase/middleware.ts` → `/api/whatsapp/*` é pública (a Meta chama sem login; a rota se protege por token e assinatura).
- `crm/types.ts`, `crm/channels.ts` → origens padrão ganham "WhatsApp" e "Meta Ads" (esta marcada como anúncio, entra em "Responder leads de anúncio").
- `.env.example`, `docs/whatsapp-leads.md`, `logs/HUB-SYNC.md` → variáveis, passo a passo da Meta e nota de divergência.
- Decisões: origem WhatsApp; com `referral` de anúncio, origem Meta Ads + plataforma "Meta" + id do anúncio; sem `referral`, nada de anúncio é gravado. Nada do texto da conversa é guardado.

## Banco
Rodar `supabase/migrations/012_whatsapp_leads.sql` e cadastrar o número em `crm_whatsapp_numbers` (SQL em `docs/whatsapp-leads.md`).

## Verificação
- `npx tsc --noEmit` e `npm run build` limpos.
- Testes da lógica (`node --test`): 9 de 9 (assinatura válida/inválida/ausente/corpo alterado; mensagem; status ignorado; reação ignorada; anúncio com id; referral de post; sem referral; telefone oculto; payload estranho).
- Banco (Postgres local): número não mapeado; contato novo; reenvio do mesmo evento; 2ª mensagem; contato do vendedor digitado em outro formato, sem o 9; card aberto em outra etapa preservado; telefone oculto; anúncio com e sem id; contato só com card fechado; 10 mensagens simultâneas do mesmo contato (1 contato, 1 card); mesmo evento 10 vezes ao mesmo tempo (1 card); origens personalizadas; conta sem etapa de entrada; permissão (usuário comum não executa).
- Rota real (`next start` + banco local por trás de um PostgREST simulado): GET com token certo/errado; assinatura inválida e ausente (401, nada gravado); contato novo com follow-up agendado; reenvio; evento de status; anúncio; telefone oculto; número não mapeado; JSON inválido; banco fora (500, evento não fica marcado e o reenvio cadastra); 8 mensagens simultâneas e 8 reenvios simultâneos pela rota (1 contato, 1 card).
- NÃO testado: contra a Meta de verdade (sem acesso ao painel da Meta aqui), nem contra o Supabase real. O código está na branch de trabalho; não foi para `main` (produção), por pedido.
