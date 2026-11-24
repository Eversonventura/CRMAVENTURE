# Sprint 30 — Administrador vê o Diário dos outros, mas só lê

Pedido: o administrador tem os dados de todos na Visão Geral, mas não deve entrar na conta de outra pessoa e mexer por ela, para não burlar os dados.

## O que mudou
- `diario/page.tsx`, `DiarioView.tsx` → ao escolher outra pessoa no Diário (administrador/gestor), a tela fica só para leitura (`inert`) com aviso; o sorteio das abordagens do dia só roda para quem vê o próprio Diário.
- `diario/actions.ts` → `approachLead`, `swapPick`, `setOffDays`, `clearOffDay` e `registerApproach` recusam quando a pessoa do pedido não é quem está logado ("Você só registra ações no seu próprio Diário."), valendo também se alguém chamar a ação direto.
- Visão Geral e dados de todos continuam disponíveis para administrador e gestor.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado no navegador. Não mexi em Fluxo e Tarefas (administrador e gestor continuam podendo editar cards e tarefas de qualquer pessoa).
