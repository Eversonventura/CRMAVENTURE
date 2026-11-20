# CRM Aventure — regras de trabalho

## Toda atualização é uma sprint, com log
- Cada mudança pedida pelo usuário vira uma **sprint numerada** (a próxima depois da última em `logs/INDEX.md`). Mudança grande: divida em mais de uma sprint.
- Ao concluir a sprint, no **mesmo commit** do código:
  1. crie `logs/sprint-N.md` (formato abaixo);
  2. acrescente a linha em `logs/INDEX.md` (`| módulo/assunto | N |`).
- Mensagem de commit começa com `Sprint N:`.
- Antes de commitar: `npx tsc --noEmit` e `npm run build` limpos. Mudança de schema vai em `supabase/schema.sql` **e** em `supabase/migrations/NNN_nome.sql` (o que o usuário roda no SQL Editor para um banco que já existe).
- Publicar: push na branch de trabalho e em `main` (a Vercel faz o deploy sozinha).

## Sincronização com o CRM do Aventure Hub
- Este sistema nasceu como cópia do módulo CRM do Hub (`Eversonventura/aventure-hub`, `app/(admin)/crm`) e **divergiu de propósito**. Atualizações do Hub são trazidas por sprint, com revisão, nunca copiadas por cima.
- Quando o usuário pedir para sincronizar com o Hub (ou mencionar que atualizou o CRM no Hub): leia `logs/HUB-SYNC.md`, rode `scripts/hub-changes.sh`, classifique cada commit (trazer / não trazer / adaptar), aplique com `scripts/hub-port.sh <hash>`, resolva os `.rej`, e atualize `ULTIMO_COMMIT_SINCRONIZADO` e a tabela de `logs/HUB-SYNC.md` no mesmo commit da sprint.
- Não traga o que é só do Hub (Impulso, Desbrava, Clientes, Financeiro, Anúncios, Orçamentos, WhatsApp). Ao adaptar, lembre que vendedor só vê as próprias oportunidades (RLS) e que tudo é por conta (`workspace_id`).
- Se o Hub mudou o banco do CRM, escreva a migration aqui (schema + `supabase/migrations/`) e peça ao usuário para rodá-la.

## Contrato com o Hub (a área de membros Desbrava usa este banco)
O Hub cria/lê contas aqui com a chave de serviço. **Não renomeie nem remova**, sem combinar com o usuário: gatilho `handle_new_user` (cria a conta própria "Conta de <nome>"), `profiles.id/email`, `workspaces(id, name, owner_id, created_at)`, função `seed_workspace_defaults(p_ws uuid)` (execução liberada para `service_role`), `team_members(workspace_id, profile_id, full_name, email, crm_role)` único em `(workspace_id, profile_id)` com `crm_role` ∈ administrador/gestor/vendedor, e `crm_opportunities(workspace_id, status, closed_at, estimated_value)`. **Só o Hub cria contas**: o usuário do CRM não cria conta nova (não recrie `create_workspace` nem botões de "criar conta"); ele só convida pessoas para a conta que já tem. Detalhes em `logs/HUB-SYNC.md`.

## Formato de `logs/sprint-N.md`
```
# Sprint N — título curto

Pedido: o que o usuário pediu, em uma ou duas frases.

## O que mudou
- arquivo → o que foi feito e por quê

## Banco
Migration a rodar (ou "não muda schema").

## Verificação
Comandos rodados e resultado; o que NÃO foi testado.
```

## Arquitetura (resumo)
- Next.js 15 + Supabase + Vercel. Rotas em `app/(app)/crm/*`; conta/compartilhamento em `app/(app)/conta`.
- Multi-conta: toda tabela tem `workspace_id` (default = conta ativa, vinda do header `x-workspace-id`) + RLS. `team_members` = membros da conta; papéis `administrador`/`gestor`/`vendedor`.
- Novas tabelas precisam de `workspace_id uuid not null default public.active_workspace_id()` e policies por conta.
