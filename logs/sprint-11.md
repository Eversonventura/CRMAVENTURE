# Sprint 11 — Sincronização com o Hub: meta olímpica nova, desconto na 1ª mensalidade e destaques

Pedido: sincronizar com o Hub depois de novas atualizações do CRM (Hub `24ae357` → `6b6c598`, 19/11).

## O que mudou (commit do Hub → aqui)
- `893e63f` Card perdido fica na coluna Perdido na hora → `funil/FunilBoard.tsx` (aplicado sem conflito).
- `7ef5ead` Recorrência usa a mensalidade do fechamento na meta; **desconto na 1ª mensalidade** → `funil/ClosedDealModal.tsx` (nova opção "Com desconto na 1ª mensalidade", em % ou R$, com resumo e "já foi paga"; grava a mensalidade cheia no cliente e a 1ª parcela com desconto em Recebimentos), `olympic-sales.ts` (venda recorrente = mensalidade do cliente vinculado, mesmo sem valor estimado), `visao-geral/page.tsx`. Adaptado: textos "Recebimentos" no lugar de "Financeiro"; sem serviços pontuais.
- `d987e11`, `61313b1`, `ce3ead2`, `ee0f6ea` Meta olímpica em estado final → `visao-geral/OlympicCard.tsx` (barra só com os traços dos marcos, uma caixa por medalha com "faltam…", destaque nos marcos batidos), novos `OlympicBanner.tsx` (banner do marco e confete uma vez por marco/mês), `OlympicCelebration.tsx` (confete e card "Você bateu a meta!", RMV em diamante rosa), `OlympicTierButton.tsx` (caixa clicável para rever a comemoração). Adaptado: o modo **valor/contratos** da Sprint 8 foi mantido (textos em "N contratos"); a chave do "já comemorei" guardada no navegador agora inclui a **conta**; a barra volta à escala proporcional do Hub e a "escada" da Sprint 6 foi removida (os nomes saíram de cima da barra, então não há mais sobreposição).
- `f3db887` Remove o cartão "Recebido no mês (caixa)" → `OlympicCard.tsx`, `page.tsx`. O caixa continua em Recebimentos.
- `6b6c598` Destaque nos cartões de metas (batida em verde com selo e brilho, "Quase lá", "Abaixo da meta") → `visao-geral/page.tsx`.
- `logs/HUB-SYNC.md` → ponto atual `6b6c598`, tabela dos commits e lista de arquivos que divergem de propósito.

## Banco
Não muda schema. Nenhuma migration nova no Hub citando tabelas do CRM.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Regra de venda recorrente testada por script (caso Vernissage: sem valor estimado conta a mensalidade de R$ 2.100; mensalidade do fechamento vence o valor estimado; plano de projeto continua mandando). Cartão renderizado em R$ 2.100 (abaixo do Bronze), R$ 4.000 (Bronze e Prata batidos) e 5 contratos (Ouro). Não testado no navegador: confete, popup de comemoração, fluxo do desconto, cartões de metas.
