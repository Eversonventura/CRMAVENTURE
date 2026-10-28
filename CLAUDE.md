# CRM Aventure — regras de trabalho

## Toda atualização é uma sprint, com log
- Cada mudança pedida pelo usuário vira uma **sprint numerada** (a próxima depois da última em `logs/INDEX.md`). Mudança grande: divida em mais de uma sprint.
- Ao concluir a sprint, no **mesmo commit** do código:
  1. crie `logs/sprint-N.md` (formato abaixo);
  2. acrescente a linha em `logs/INDEX.md` (`| módulo/assunto | N |`).
- Mensagem de commit começa com `Sprint N:`.
- Antes de commitar: `npx tsc --noEmit` e `npm run build` limpos. Mudança de schema vai em `supabase/schema.sql` **e** em `supabase/migrations/NNN_nome.sql` (o que o usuário roda no SQL Editor para um banco que já existe).
- Publicar: push na branch de trabalho e em `main` (a Vercel faz o deploy sozinha).

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
