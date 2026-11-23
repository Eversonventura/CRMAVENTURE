# Sprint 15 — Funil padrão enxuto

Pedido: o funil padrão deve ter só Lead, Contato realizado, Fechamento e Perdido; se o
cliente quiser mais fluxo no pipeline, ele adiciona.

## O que mudou
- `supabase/schema.sql`, `supabase/migrations/004_funil_enxuto.sql` → `seed_workspace_defaults` passa a montar a conta nova com as etapas Lead, Contato realizado, Fechamento (ganho) e Perdido, e uma regra de follow-up em "Contato realizado" (a cada 3 dias, meta de 5 por dia). Antes eram 12 etapas. A assinatura da função não muda (o Hub continua chamando `seed_workspace_defaults(p_ws)` ao criar a conta de um cliente, então os clientes novos já nascem com o funil enxuto). **Contas que já existem não são alteradas.**
- Mais etapas: o administrador adiciona, renomeia e reordena em Funil → Etapas (já existia).
- `crm/visao-geral/page.tsx` → o cartão "Propostas apresentadas" só aparece quando a conta tem uma etapa de proposta; no funil enxuto ele ficaria sempre zerado e vermelho.

## Banco
**Rodar `supabase/migrations/004_funil_enxuto.sql`** no SQL Editor (só redefine a função; não mexe em nenhuma conta existente).

## Verificação
`npx tsc --noEmit` e `next build` limpos. Testado em Postgres local: schema novo cria Lead > Contato realizado > Fechamento > Perdido com 1 regra de follow-up; banco no estado anterior + migration 004: a conta que já existia continua com 12 etapas e a conta nova nasce com 4. Não testado no navegador. A conta de teste atual continua com as 12 etapas (para enxugar, é só excluir as etapas em Funil → Etapas).
