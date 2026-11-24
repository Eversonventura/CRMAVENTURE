# Sprint 24 — Modo "contratos" no sistema todo

Pedido: ao escolher a meta olímpica por contratos, a Visão Geral não computava os contratos fechados; o fluxo, o fechamento e as metas do mês também devem seguir (sem preço nem valores), em B2B e B2C.

## O que mudou
- Causa do contador zerado: `olympic-sales.ts` descartava fechamentos sem valor (`value <= 0`). Novo parâmetro `countWithoutValue`; a Visão Geral o liga no modo contratos (testado: 2 contratos sem valor contam no modo contratos e 0 no modo valor).
- `business.ts`, `settings.ts` → `salesMode` ("valor" | "contratos") lido de `crm_goals.olympic_mode` e entregue a todo o CRM pelo provedor de configurações.
- Fluxo (`FunilBoard.tsx`): no modo contratos, o card e o total da coluna não mostram valor; ao arrastar para a etapa de ganho aparece "Contrato fechado" (sem pedir valor nem forma de pagamento).
- `OpportunityModal.tsx` → campo "Valor estimado" some no modo contratos.
- Visão Geral (`visao-geral/page.tsx`) → no modo contratos: "Negócios fechados" vira "Contratos fechados"; saem Receita fechada, Ticket médio, Valor em negociação e as colunas/cartões de receita do painel por vendedor.
- Diário (`DiarioView.tsx`) → cartão de vendas do mês sem receita no modo contratos.
- Metas do mês (`GoalsForm.tsx` + Configurações) → no modo contratos, sem Receita fechada e Ticket médio; "Contratos fechados"; metas por vendedor só de contratos (sem apagar as de receita já gravadas — `saveMemberSalesGoals` ignora o campo ausente); "Propostas / contratos apresentados"; salvar nunca trava e confirma.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` limpo; teste da regra de contagem com esbuild/node. Não testado no navegador contra o Supabase real.
