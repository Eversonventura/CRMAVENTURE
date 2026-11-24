# Sprint 26 — Meta e cartão "Leads de anúncio recebidos"

Pedido: nas metas do mês, além de "Leads recebidos", ter "Leads de anúncio recebidos".

## O que mudou
- `goals.ts` → nova meta `leads_anuncio` (padrão 30), editável em Configurações → Metas do mês.
- `visao-geral/page.tsx` → novo cartão "Leads de anúncio recebidos" (oportunidades criadas no período com canal "Tráfego pago"); só aparece se a conta recebeu leads de anúncio no período ou definiu a meta.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado contra o Supabase real.
