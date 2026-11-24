# Sprint 29 — Uma conta por pessoa (sem trocar de conta)

Pedido: gestor, vendedor e nem o administrador devem conseguir acessar outras contas; no seletor aparecia a conta pessoal ("Conta de …") e a da empresa.

## O que mudou
- `supabase/migrations/007_conta_unica.sql` + `schema.sql` → `active_workspace_id()` deixa de ler o cabeçalho `x-workspace-id` e escolhe sempre a mesma conta: a da empresa (a que o Hub criou ou para a qual a pessoa foi convidada); a conta automática "Conta de <nome>" fica por último. Mesma assinatura, então RLS e Hub seguem iguais. Quem tentar forçar outra conta pelo cabeçalho continua na conta certa (testado).
- `lib/access.ts` → mesma regra no app; o cookie `crm_ws` não é mais lido.
- `lib/supabase/server.ts`, `client.ts` → não enviam mais o cabeçalho de conta; `lib/workspace.ts` e `switchWorkspace` removidos.
- `components/AppSidebar.tsx` → o seletor virou só o nome da conta (para a pessoa saber em qual empresa está).
- `perfil/ProfileManager.tsx` → mostra só a conta em uso, sem "Usar esta conta".
- Docs (`CLAUDE.md`, `HUB-SYNC.md`) atualizados. Gatilho `handle_new_user` e o nome "Conta de …" ficam (contrato com o Hub).

## Banco
Rodar `supabase/migrations/007_conta_unica.sql`.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Teste no Postgres local: pessoa com "Conta de Gil" + "Cliente X" cai em "Cliente X", administrador também, e forçar o cabeçalho não muda a conta. Não testado no navegador.
