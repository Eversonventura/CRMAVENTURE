# Sprint 12 — Só o Hub cria contas

Pedido: o avantecrm é uma plataforma interna dos clientes; criar conta nova
só pode ser feito pelo Aventure Hub (o dono do sistema). O cliente pode apenas
convidar pessoas (acesso secundário). Remover "Outra conta" da tela.

## O que mudou
- `app/(app)/conta/AccountManager.tsx` → removido o bloco "Outra conta" (criar conta).
- `lib/workspace-actions.ts` → removida a ação `createWorkspace`.
- `app/(app)/perfil/ProfileManager.tsx` → o texto deixa de falar em "criar outra conta".
- `supabase/migrations/002_sem_criar_conta.sql` e `supabase/schema.sql` → a função `create_workspace` é **apagada do banco**. Só esconder o botão não bastaria: qualquer usuário logado poderia chamar a função direto pela API e criar uma conta. O Hub não usa essa função (cria a conta com a chave de serviço: `insert` em `workspaces` + `seed_workspace_defaults`), então nada dele é afetado. A mensagem de `delete_workspace` deixa de sugerir "crie outra antes de excluir".
- `CLAUDE.md` e `logs/HUB-SYNC.md` → regra registrada: só o Hub cria contas.

## Banco
**Rodar `supabase/migrations/002_sem_criar_conta.sql`** no SQL Editor do Supabase (apaga `create_workspace` e atualiza `delete_workspace`).

## Verificação
`npx tsc --noEmit` e `next build` limpos. Testado em Postgres local: schema novo sem a função; banco antigo + migration 002 (a função existia e some); com o usuário logado, criar conta pela API falha; convidar pessoas continua funcionando; excluir a única conta continua barrado; o Hub (service_role) segue criando e semeando contas. Não testado no navegador.

## Fora do escopo (levantado, não alterado)
- O cadastro público (`/cadastro`) ainda existe e cria uma conta própria para quem se cadastra; fechar isso é decisão a tomar.
- "Excluir esta conta" continua disponível ao dono da conta e apagaria tudo (inclusive quando a conta foi criada pelo Hub, deixando o vínculo do Hub apontando para uma conta que não existe mais).
