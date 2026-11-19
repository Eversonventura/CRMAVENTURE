# Sprint 8 — Meta olímpica por vendas, escolha "valor ou contratos" e gráficos

Pedido: adotar a regra de vendas fechadas do Hub na meta olímpica e permitir
escolher se a meta é medida por contratos fechados ou por valor.

## O que mudou
- Regra do Hub `1a46b5b` (adaptada) → `crm/olympic-sales.ts` (novo): a meta olímpica conta as **vendas fechadas no mês**, não os pagamentos. Valor = o do plano de pagamento, se definido, senão o valor estimado da oportunidade; mais vendas avulsas/comissões lançadas direto em Recebimentos (data = primeiro vencimento). Sem os serviços pontuais, que só existem no Hub. Dia de fechamento em horário de Brasília.
- **Novo:** modo da meta olímpica, escolhido em Metas: *Por valor vendido* (R$, como antes: ponto de partida, inflação, Bronze/Prata/Ouro/RMV) ou *Por contratos fechados* (quantidade; padrão 3/4/5/10). Contrato = fechamento do funil + venda avulsa; comissão não é contrato. Guardado em `crm_goals` (`olympic_mode`, `olympic_count_*`), sem mudar o schema.
  - `crm/olympic.ts` (modo, alvos por contratos, `activeOlympicTargets`), `crm/GoalsEditor.tsx` (escolha e campos), `crm/goal-actions.ts` (valida inteiros e Bronze ≤ Prata ≤ Ouro ≤ RMV).
- `visao-geral/OlympicCard.tsx` → mostra o modo, valores em R$ ou "N contratos", "Recebido no mês (caixa)" só como informação e a lista "Ver as N vendas deste mês".
- `visao-geral/page.tsx` → consulta os fechados do mês e calcula pela regra nova.
- Gráficos do Hub `6a0f1d0` → `visao-geral/CrmCharts.tsx` (recharts): funil, conversão e tempo por etapa em barras; canais de venda e motivos de perda em pizza; ranking de vendedores e tarefas atrasadas em barras.

## Banco
Não muda schema (usa `crm_goals`, que já existe). Nova dependência: `recharts`.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Regra de vendas testada por script (plano de projeto sobrepõe o valor estimado; fechamento em 30/11 às 22h de Brasília conta em novembro e 01/12 não; valor zero e venda de agosto parcelada ficam de fora; 1ª mensalidade não duplica; comissão fora da contagem de contratos). Cartão renderizado nos dois modos. Não testado: tela de Metas no navegador e gráficos com dados reais.
