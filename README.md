# CRM Aventure

CRM de prospecção, funil, tarefas, Diário de abordagens, metas e propostas —
cópia independente do módulo CRM do Aventure Hub. **Não depende do Hub**: tem
banco, login e deploy próprios.

Stack: Next.js 15 + Supabase (auth, banco, storage) + Vercel. Tudo cabe nos
planos gratuitos.

## Como funcionam as contas

- Quem se cadastra ganha uma **conta própria** (funil, regras de follow-up e metas já prontos).
- O dono **compartilha a conta** em *Compartilhar conta*, convidando por e-mail com um papel:
  - **Administrador**: tudo, inclusive etapas, metas, regras, recebimentos e convites.
  - **Gestor**: vê toda a carteira.
  - **Vendedor**: só as oportunidades e tarefas em que é o responsável.
- Convidado que já tem login entra na hora; quem ainda não tem entra automaticamente ao se cadastrar com o mesmo e-mail.
- Uma pessoa pode estar em várias contas e alternar no seletor do topo.
- O isolamento é feito no banco (RLS): toda tabela tem `workspace_id`.

## Publicar (grátis)

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **SQL Editor → New query**: cole todo o `supabase/schema.sql` e rode **uma vez**.
3. **Authentication → Providers → Email**: para testar rápido, desligue *Confirm email*
   (ou deixe ligado e configure o *Site URL* abaixo).
4. **Authentication → URL Configuration**: *Site URL* = a URL da Vercel.
5. **Settings → API**: copie *Project URL*, *anon key* e *service_role key*.

### 2. Vercel
1. *Add New → Project* e importe este repositório (plano Hobby).
2. Variáveis de ambiente (veja `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
   Opcionais: `ANTHROPIC_API_KEY` (sugestão de mensagens por IA), `RESEND_API_KEY` e `RESEND_FROM_EMAIL` (e-mails).
3. *Deploy*. Abra a URL, clique em **Criar conta** e comece.

O cron diário (`vercel.json`, `/api/cron/crm`) gera as tarefas das cadências e,
se houver `RESEND_API_KEY`, envia lembretes de reunião e alertas. O plano
Hobby permite 1 execução por dia.

> O Supabase gratuito pausa o projeto após ~7 dias sem acesso; um ping
> periódico (ex.: UptimeRobot na URL do app) evita isso.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
```

## O que mudou em relação ao módulo do Hub

- Login próprio com cadastro; `team_members` agora são os **membros da conta**.
- Sem Clientes/Financeiro/Anúncios/WhatsApp do Hub. Ao fechar um negócio o CRM
  cria um cliente simples e a aba **Recebimentos** controla as parcelas
  (alimenta a meta olímpica da Visão geral).
- Etapas, regras de follow-up e metas padrão são criadas por conta (`seed_workspace_defaults`).
- Automações (antes Edge Functions + pg_cron) viraram uma rota de cron da Vercel.
