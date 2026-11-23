# Sprint 18 — "Funil" passa a se chamar "Fluxo"

Pedido: mudar o nome "Funil" para "Fluxo".

## O que mudou
- `components/AppSidebar.tsx` → item do menu agora é "Fluxo" (a rota continua `/crm/funil`, para não quebrar links salvos).
- Textos visíveis em Diário, Visão geral, Contatos & Empresas, Configurações, Perfil, login, metadados (`layout.tsx`, `manifest.ts`) e README: "funil" → "fluxo" (títulos, dicas, mensagens de erro e o texto enviado à IA de sugestão).
- `data-funil-draggable` → `data-fluxo-draggable` (atributo interno, trocado nos dois lados).
- Nomes de arquivos, rotas, tipos (`FunilOpportunityRow`, `FunilBoard`) e banco não mudaram.

## Banco
Não muda schema. Etapas padrão de contas novas (Lead, Contato realizado, Fechamento, Perdido) seguem iguais.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não foi testado no navegador.
