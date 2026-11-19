# Sprint 7 — Melhorias de CRM trazidas do Aventure Hub (lote 1)

Pedido: trazer para o avantecrm as atualizações que o usuário fez no CRM do
Hub depois da cópia inicial (Hub em `8b139b8`, 21/10 → `768bd0f`, 18/11).

## O que mudou (commit do Hub → aqui)
- `e2527de` Excluir lead no card → `crm/actions.ts` (`deleteOpportunityAction`), `funil/OpportunityModal.tsx`. Ajuste daqui: vendedor só enxerga as próprias oportunidades, então a empresa só é apagada junto quando quem exclui vê toda a carteira (administrador/gestor); vendedor apaga só a oportunidade e a empresa fica. Texto "recebimentos" no lugar de "financeiro".
- `c636cdf` Diário prioriza leads com WhatsApp/telefone → `diario/picks.ts`.
- `bf5eddd` Contato cadastrado em Contatos e Empresas entra no funil em "Novo lead" → `contatos/actions.ts`.
- `dc3b081` Lead cadastrado/importado entra em "Novo lead" mesmo com mais de uma etapa de entrada → `contatos/actions.ts` (`findNewLeadStage`).
- `768bd0f` Etapas do funil com títulos nos campos e nomes de papel/situação mais claros → `funil/StageManagerModal.tsx`, `types.ts`.

Ficam para a Sprint 8: `1a46b5b` (meta olímpica por vendas) e `6a0f1d0` (gráficos). Não portados (específicos do Hub): `5485feb`, `7fe53e6` (Impulso), `fd37924` (Desbrava). `876b909` já resolvido na Sprint 6.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Patches aplicados sem conflito. Não testado no navegador.
