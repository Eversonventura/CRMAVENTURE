# Sprint 31 — Diário de outra pessoa: WhatsApp continua liberado

Pedido: ao ver o Diário de um gestor ou vendedor, o administrador deve poder mandar mensagem para os leads dele (por exemplo, se a pessoa faltar).

## O que mudou
- `diario/DiarioView.tsx` → o modo só leitura (Sprint 30) deixou de usar `inert` e passou a usar `fieldset disabled`: botões, campos e seletores seguem desativados, mas os links de WhatsApp dos leads ficam clicáveis. O aviso da tela explica isso.
- Nada é gravado em nome da outra pessoa: o link só abre o WhatsApp; as proteções do servidor da Sprint 30 continuam.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado no navegador.
