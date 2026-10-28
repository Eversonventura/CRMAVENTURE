# Sprint 3 — Logo avantecrm e rodapé "Powered by Aventure"

Pedido: trocar a logo do CRM pela nova (avantecrm) e informar no rodapé do
sistema "Powered by Aventure".

## O que mudou
- `public/logo.svg` → nova logo avantecrm (usada no login, cadastro e cabeçalho). A logo antiga da Aventure foi preservada em `public/logo-aventure.svg`.
- `components/Logo.tsx` → texto alternativo "avantecrm".
- `components/PoweredBy.tsx` (novo) → rodapé "Powered by" + logo da Aventure.
- `app/(app)/layout.tsx`, `app/login/page.tsx`, `app/cadastro/page.tsx` → rodapé em todas as telas.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Não conferido visualmente no navegador; o ícone compacto (`logo-symbol.svg`) e o favicon continuam os da Aventure.
