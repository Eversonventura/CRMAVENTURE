# Sprint 6 — Meta olímpica: marcos sem sobreposição

Pedido: no cartão "Meta olímpica" da Visão geral, os rótulos Bronze, Prata e
Ouro (e seus valores) apareciam um em cima do outro.

## O que mudou
- `app/(app)/crm/olympic.ts` → `ladderPosition`: posição do valor na barra em "escada". Os marcos Bronze, Prata, Ouro e RMV ficam a distâncias iguais (25/50/75/100%) e o valor avança linearmente dentro de cada degrau. Antes a escala era proporcional ao valor, e como o RMV é o dobro do Ouro, os três primeiros marcos ficavam a ~70 px um do outro, menos que a largura dos rótulos.
- `app/(app)/crm/visao-geral/OlympicCard.tsx` → usa a escada; o rótulo do RMV é alinhado à direita (não vaza da borda); no celular a barra mostra só o ícone de cada marco e os valores vão para uma legenda 2×2 abaixo da barra.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Função testada (0 → 0%, Bronze 25%, Prata 50%, Ouro 75%, RMV e acima 100%, metas zeradas sem erro). Componente real renderizado e conferido em 1400 px e 390 px de largura, com R$ 0, R$ 3.800, R$ 6.000 e R$ 9.000. Não conferido no sistema em produção.
