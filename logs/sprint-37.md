# Sprint 37 — Gestor também cria etapas do fluxo

Pedido: o gestor pode criar etapas do fluxo também.

## O que mudou
- `funil/stage-actions.ts` → criar, renomear/ajustar, reordenar e excluir etapa passam a valer para administrador e gestor (`requireManager`); criar, renomear e excluir pipeline continuam só do administrador.
- `funil/page.tsx`, `FunilBoard.tsx` → o botão "Etapas" aparece para administrador e gestor; o botão "Pipelines" só para o administrador.
- `supabase/migrations/010_gestor_etapas.sql` (+ `schema.sql`) → política `crm_stages: gestor gerencia`.
- Follow-ups por etapa (Configurações) já listavam as etapas do fluxo; etapa criada pelo gestor entra lá sozinha.

## Banco
Rodar `supabase/migrations/010_gestor_etapas.sql`.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Teste de RLS no Postgres local: gestor cria e renomeia etapa; é barrado em criar pipeline; vendedor é barrado em criar etapa. Não testado no navegador.
