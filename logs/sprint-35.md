# Sprint 35 — Data de entrada do lead e prioridade preservada

Pedido: ter o campo de data de entrada do lead (o formulário não tinha) e que a importação o reconheça.

## O que mudou
- `funil/OpportunityModal.tsx`, `form-fields.ts`, `actions.ts` → novo campo "Data de entrada do lead" (padrão: hoje; no lead existente mostra a data de criação). Grava `created_at` (e `entered_at` ao criar); ao editar só altera se a pessoa mudar o dia, então salvar sem mexer não muda a hora original.
- `funil/details.ts`, `funil/page.tsx`, `diario/actions.ts` → a prioridade passou a ser lida do banco. Antes o formulário nunca a carregava e, ao editar e salvar um lead, a prioridade gravada era apagada. O formulário também mostra prioridade em texto livre vinda da planilha (viabilidade, análise…) como opção.
- `funil/FunilBoard.tsx` → linhas do fluxo passam a ter `createdAt`.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado no navegador.
