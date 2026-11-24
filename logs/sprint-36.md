# Sprint 36 — Fluxo por data de entrada e origens em ordem alfabética

Pedido: os cards do fluxo devem seguir a data de entrada do lead (os últimos que entraram ficam embaixo); origens em ordem alfabética, e a origem nova entra sozinha no lugar certo.

## O que mudou
- `funil/FunilBoard.tsx` → em cada etapa os cards ficam ordenados pela data de entrada do lead (`createdAt`): os que entraram primeiro em cima e os mais recentes embaixo. Um botão no topo ("Ordem: mais antigos primeiro / mais recentes primeiro") inverte, e a escolha fica lembrada neste navegador. Antes a ordem seguia a ordem em que o banco devolvia as linhas.
- `channels.ts`, `settings.ts` → origens sempre em ordem alfabética (sem diferenciar acento ou maiúscula); vale para a lista de Configurações e para o campo "Canal de aquisição". Origem nova entra no lugar certo sozinha.
- Esta sprint foi publicada junto do commit da Sprint 35 (os arquivos foram para o mesmo commit); aqui ficam o registro e a verificação.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado no navegador.
