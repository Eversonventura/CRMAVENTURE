# Sprint 0 — Base do CRM Aventure (cópia independente do módulo CRM do Hub)

Pedido: copiar o módulo CRM do Aventure Hub para um sistema próprio, sem
vínculo com o Hub; cada usuário tem seus dados e pode compartilhar a conta
com outros usuários.

## O que mudou
- `app/(app)/crm/**` → módulo CRM copiado (Diário, Visão geral, Funil, Tarefas, Contatos e Empresas, Agenda, Propostas), sem as dependências do Hub (Clientes, Financeiro, Anúncios, WhatsApp, Serviços pontuais).
- `supabase/schema.sql` → schema único: contas (`workspaces`), membros (`team_members`), convites, todas as tabelas `crm_*`, `clients` (mínimo) e `receivables`, RLS por conta, triggers, `seed_workspace_defaults` (funil, regras de follow-up e metas padrão), RPCs de compartilhamento, bucket `crm-attachments`.
- `lib/supabase/*`, `lib/access.ts`, `lib/workspace*.ts` → conta ativa por cookie + header `x-workspace-id`; o banco só honra se a pessoa for membro.
- `app/(app)/conta/*` → tela "Compartilhar conta" (convidar, papel, remover, sair, renomear, criar e excluir conta).
- `app/login`, `app/cadastro`, `app/auth/*` → login, cadastro e recuperação de senha próprios.
- `app/(app)/crm/recebimentos/*` → parcelas a receber (porta do bloco do Financeiro do Hub); alimenta a meta olímpica.
- `app/api/cron/crm/route.ts` + `vercel.json` → cadências e e-mails (antes Edge Functions + pg_cron), 1x/dia (plano Hobby).
- `app/(app)/crm/email.ts` → e-mail via Resend direto (opcional).

## Banco
Rodar `supabase/schema.sql` inteiro, uma vez, num projeto novo.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Schema testado em Postgres 16 local (stubs de auth/storage): isolamento entre contas, header forjado ignorado, convite (usuário existente e pendente), papéis, triggers. Fluxo completo validado pelo usuário em produção (Vercel + Supabase).
