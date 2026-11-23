# Sprint 13 — Menu lateral, sem "CRM" ao lado da logo, sem aba Recebimentos

Pedido: tirar o nome "CRM" que ficava ao lado da logo; ter um menu lateral para o
CRM; tirar a aba Recebimentos (a aba Propostas já mostra o pagamento).

## O que mudou
- `components/AppSidebar.tsx` (novo) → menu lateral: logo (sem o texto "CRM"), seletor de conta, itens Diário, Visão Geral, Funil, Tarefas, Contatos & Empresas, Agenda e Propostas, e embaixo Compartilhar conta, perfil (foto e nome) e Sair. No celular vira uma barra superior com botão que abre o menu. Itens com `adminOnly` só aparecem para o administrador (usado na Sprint 14).
- `app/(app)/layout.tsx` → usa o menu lateral no lugar do cabeçalho; "Powered by Aventure" continua no rodapé.
- `app/(app)/crm/layout.tsx` → sem as abas do topo.
- Removidos: `components/AppHeader.tsx`, `crm/CrmTabs.tsx`, a página `crm/recebimentos/*` e `financeiro/types.ts`.
- `financeiro/receivables-actions.ts` → saem as ações de dar baixa, desfazer baixa, excluir venda e venda avulsa, que só a página removida usava; ficou `defineDealPayment` (usado ao fechar uma venda).
- Textos que falavam em "Recebimentos" ajustados (Propostas, janela de venda fechada, cartão da meta olímpica, equipe).

## Banco
Não muda schema. As parcelas continuam sendo gravadas em `receivables` ao fechar a venda; só não há mais tela para dar baixa nelas aqui (o dinheiro fica no Financeiro do Hub).

## Verificação
`npx tsc --noEmit` e `next build` limpos. Menu renderizado com o componente real em 1280 px e 390 px. Não testado no navegador contra o Supabase.
