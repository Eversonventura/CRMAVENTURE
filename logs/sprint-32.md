# Sprint 32 — Meta olímpica visível para todos, mês a mês

Pedido: a meta olímpica (barra, medalhas, setas de mês) precisa aparecer assim para todos, não só para o administrador.

## O que mudou
- `visao-geral/page.tsx` → o cartão da meta olímpica aparece para administrador, gestor e vendedor, com as setas de mês anterior/próximo.
- `supabase/migrations/008_meta_olimpica_para_todos.sql` (+ `schema.sql`) → função `crm_month_deals(p_start, p_end)`: devolve, sem nomes de clientes, os negócios fechados do período na conta ativa (valor, tipo, plano de pagamento do projeto). Necessária porque o vendedor só lê os próprios leads e os planos de pagamento são só do administrador; a meta olímpica é da equipe. Só membros da conta ativa recebem dados.
- Gestor e vendedor usam essa função e a mesma regra de contagem do administrador (`monthlySales`), então os números batem. A lista "Ver as N vendas deste mês" (com nomes de clientes) continua só para o administrador (`OlympicCard` ganhou `showSales`).

## Banco
Rodar `supabase/migrations/008_meta_olimpica_para_todos.sql`.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Teste no Postgres local: vendedor lê 0 fechamentos pelo RLS, mas a função devolve os 2 da equipe; pessoa de fora da conta recebe 0. Não testado no navegador.
