# Log de atualizações — avante CRM

Registro de cada atualização, da mais recente para a mais antiga.
Cada entrada indica a sprint, o que mudou e o commit.

## 2026-10-28 — Sprint 2
- **Rodapé "powered by Aventure"** em todas as telas (logadas, login, cadastro, definir senha, validação de link). Componente `components/PoweredBy.tsx`; logo original guardada em `public/logo-aventure.svg`.
- **Renomeado para "avante CRM"**: título da aba, nome do app instalado (manifest) e remetente dos e-mails.
- **Cabeçalho**: removido o texto "CRM" solto ao lado da logo (já faz parte da logo).
- Commit: `1fb1adb`

## 2026-10-28 — Sprint 2
- **Nova logo "avante CRM"** no estilo, cor (#FF007A) e tipografia da logo da Aventure; substitui `public/logo.svg`. O ícone compacto ("a!") foi mantido.
- Commit: `eb95e2a`

## Antes — Sprint 1
- Mostra a mensagem real de erro no cadastro e no login (`3256130`).
- CRM independente com contas compartilháveis: funil, tarefas, Diário, metas, propostas, papéis (admin/gestor/vendedor) e isolamento por RLS (`462aee0`).
