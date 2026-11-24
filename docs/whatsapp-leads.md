# Leads automáticos do WhatsApp (Cloud API oficial)

Quando alguém manda a primeira mensagem para o WhatsApp comercial do cliente, o Avante acha ou cria o
contato e cria o card em **Lead** (etapa de entrada do fluxo). O vendedor segue respondendo pelo WhatsApp
Business e fazendo a cadência no Diário. O Avante só **recebe** eventos e **cadastra** leads.

## Como funciona
- Rota: `POST/GET /api/whatsapp/webhook` (`app/api/whatsapp/webhook/route.ts`), lógica em `lib/whatsapp.ts`.
- **GET**: confere `hub.verify_token` com `WHATSAPP_VERIFY_TOKEN` e devolve o `hub.challenge`.
- **POST**: confere `X-Hub-Signature-256` (HMAC-SHA256 do corpo bruto com `WHATSAPP_APP_SECRET`) antes de tudo;
  assinatura inválida = 401 e nada é processado. Eventos de status (entregue/lida) e reações são ignorados.
- O número comercial (`phone_number_id`) identifica a conta. Só números cadastrados em `crm_whatsapp_numbers` são aceitos.
- A gravação é uma função do banco (`crm_whatsapp_ingest`), numa transação só:
  - acha o contato pelo identificador do WhatsApp (`crm_contacts.wa_id`) ou pelo telefone (qualquer formato, com ou sem 55 e 9);
  - sem telefone (oculto), usa o identificador recebido e deixa o WhatsApp do contato pendente;
  - só preenche o que está vazio (o que o vendedor digitou fica);
  - se já existe card **aberto** do contato no fluxo configurado, mantém o card e a etapa; senão cria um em Lead;
  - id da mensagem (`wamid`) evita duplicar em reenvios; trava por contato evita dois cards em mensagens simultâneas;
  - falha no banco responde 500: a Meta reenvia e a gravação é segura de repetir.
- Origem: **WhatsApp**. Vindo de anúncio (`referral`), a origem é **Meta Ads**, com plataforma "Meta" e o id do anúncio.
  Sem `referral`, nenhum dado de anúncio é gravado.
- O follow-up da etapa de entrada é agendado como no cadastro manual (se a conta tiver regra nessa etapa).
- Dados guardados: contato (nome de perfil, telefone/identificador), card, id da mensagem. Nada do texto da conversa.

## Configurar (uma vez)
1. **Variáveis na Vercel** (Settings → Environment Variables; marque Production e, se for testar em Preview, Preview):
   - `WHATSAPP_VERIFY_TOKEN`: uma frase secreta que você inventa (ex.: `openssl rand -hex 24`).
   - `WHATSAPP_APP_SECRET`: Meta for Developers → seu app → Configurações do app → Básico → **Chave secreta do app**.
   - `SUPABASE_SERVICE_ROLE_KEY` já deve existir. Faça **Redeploy** depois de salvar.
2. **Banco**: rode `supabase/migrations/012_whatsapp_leads.sql` no SQL Editor do Supabase.
3. **Cadastre o número** (troque o id e o nome da conta):
   ```sql
   insert into public.crm_whatsapp_numbers (phone_number_id, workspace_id, label)
   select 'COLE_O_PHONE_NUMBER_ID', id, 'Número de teste' from public.workspaces where name = 'NOME DA CONTA';
   ```
   O `phone_number_id` aparece em Meta for Developers → WhatsApp → Configuração da API ("ID do número de telefone").
4. **Webhook na Meta**: WhatsApp → Configuração → Webhook → Editar:
   - URL de retorno de chamada: `https://SEU-DOMINIO/api/whatsapp/webhook`
   - Token de verificação: o mesmo `WHATSAPP_VERIFY_TOKEN`.
   - Clique em **Verificar e salvar** e, em "Campos do webhook", assine **messages**.
5. **Teste com o número de teste da Meta**: em WhatsApp → Configuração da API, adicione seu celular como destinatário,
   envie a mensagem modelo `hello_world` para ele e **responda** pelo seu celular. O lead deve aparecer em Lead no Fluxo.

## Teste sem a Meta
`lib/whatsapp.test.ts` (assinatura e leitura dos eventos). Para testar a rota localmente, assine o corpo com o App Secret:
```bash
BODY='{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[{"field":"messages","value":{"metadata":{"phone_number_id":"PN1"},"contacts":[{"profile":{"name":"Maria"},"wa_id":"5585999990002"}],"messages":[{"from":"5585999990002","id":"wamid.TESTE1","type":"text"}]}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | sed 's/^.* //')
curl -X POST https://SEU-DOMINIO/api/whatsapp/webhook -H "content-type: application/json" -H "x-hub-signature-256: sha256=$SIG" --data-binary "$BODY"
```
