# Sprint 10 — Funil: fechados e perdidos visíveis por 3 meses (do Hub)

Pedido: sincronizar com o Hub depois da atualização do CRM lá (Hub `768bd0f` → `24ae357`).

## O que mudou (commit do Hub → aqui)
- `24ae357` Funil: fechados e perdidos ficam visíveis por 3 meses; arrastar de volta reabre → `crm/funil/page.tsx` (carrega as abertas e as fechadas/perdidas dos últimos 90 dias, contados de `closed_at`/`lost_at`; depois saem da tela mas continuam no banco) e `crm/actions.ts` (`moveOpportunityStage`: levar um card de Fechado/Perdido para uma etapa em andamento reabre a oportunidade; o gatilho do banco zera `closed_at`/`lost_at`). Aplicado sem conflito e sem adaptação.
- `logs/HUB-SYNC.md` → ponto atual `24ae357` e linha do commit na tabela.

## Cuidados (comportamento herdado do Hub)
- Reabrir uma venda deixa de contá-la como venda (meta olímpica, metas por vendedor, vendas lidas pelo Desbrava), porque contam só oportunidades com status fechada.
- Os dados de pagamento já definidos (plano de recebimentos, cliente criado) permanecem; ao fechar de novo o sistema avisa que o pagamento já foi definido.

## Banco
Não muda schema (`closed_at`/`lost_at` já existem). Nenhuma migration nova no Hub citando tabelas do CRM.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Não testado no navegador.
