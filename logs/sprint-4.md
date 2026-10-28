# Sprint 4 — Metas ligadas a vendas e fechamentos

Pedido: as metas do CRM devem girar em torno das vendas feitas e dos
fechamentos. Escolhido: meta por vendedor + vendas e fechamentos em destaque.

## O que mudou
- `app/(app)/crm/sales-goals.ts` (novo) → métricas de vendas (`fechamentos`, `receita_fechada`) e intervalo do mês em Brasília.
- `app/(app)/crm/goal-actions.ts` → `saveMemberSalesGoals`: grava/remove a meta pessoal de cada vendedor em `crm_goals` (`owner_id` = membro); só administrador; só pessoas da conta ativa. Campo vazio apaga a meta pessoal.
- `app/(app)/crm/GoalsEditor.tsx` → seção "Metas de vendas por vendedor" (fechamentos e receita por pessoa); as metas "Negócios fechados" e "Receita fechada" existentes continuam sendo a da equipe.
- `app/(app)/crm/visao-geral/page.tsx` → painel "Vendas e fechamentos" no topo: equipe (fechamentos e receita x meta, com % e barra colorida) e tabela por vendedor com meta pessoal; metas multiplicam em períodos maiores (90 dias = 3×); vendedor sem permissão de ver tudo enxerga só a própria linha. Os cartões de venda (fechados, receita, ticket, conversão, tempo) vêm antes dos de atividade.
- `app/(app)/crm/diario/page.tsx`, `DiarioView.tsx` → card "Vendas no mês": fechamentos e receita da pessoa contra a meta pessoal (ou, sem ela, a da equipe).

## Banco
Não muda schema (`crm_goals.owner_id` e o índice único por métrica/pessoa já existiam).

## Verificação
`npx tsc --noEmit` e `next build` limpos. Não testado em tela com dados reais. A receita fechada é a soma do valor estimado dos negócios em Fechado no período (o que entrou de fato em caixa continua em Recebimentos e na meta olímpica).
