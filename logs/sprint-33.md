# Sprint 33 — Origens (canais de aquisição) personalizáveis

Pedido: colocar a opção de adicionar ou tirar origens, porque cada negócio tem seus canais de aquisição.

## O que mudou
- `supabase/migrations/009_origens.sql` (+ `schema.sql`) → tabela `crm_acquisition_channels` (nome, "é anúncio", posição) por conta; leitura para todos, escrita só do administrador (RLS).
- `crm/channels.ts` → lista padrão (a antiga) e helper das origens de anúncio. Conta sem linhas usa a lista padrão; no primeiro ajuste a lista padrão é gravada na conta e a mudança vale em cima dela.
- `configuracoes/ChannelsSection.tsx` + ações (`addChannel`, `removeChannel`, `setChannelAd`) → seção "Origens dos leads" em Configurações (só administrador): adicionar, remover (mantém ao menos uma) e marcar "é anúncio".
- `settings.ts`, `business.ts` → as origens da conta chegam a todo o CRM pelo provedor de configurações.
- `funil/OpportunityModal.tsx` → o campo "Canal de aquisição" lista as origens da conta (origem antiga que o lead já tem continua aparecendo nele); os campos de anúncio aparecem nas origens marcadas como anúncio.
- `diario/page.tsx`, `visao-geral/page.tsx` → "Responder leads de anúncio", meta e cartão de leads de anúncio passam a usar as origens marcadas como anúncio (antes só "Tráfego pago").
- Leads antigos mantêm a origem gravada. As origens com nome especial continuam ligadas aos campos extras: "Indicação passiva/ativa" (dados da indicação) e "Evento" (nome do evento).

## Banco
Rodar `supabase/migrations/009_origens.sql`.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Teste de RLS no Postgres local: administrador adiciona, duplicada é recusada; gestor e vendedor só leem. Não testado no navegador.
