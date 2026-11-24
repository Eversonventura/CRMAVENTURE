# Sprint 28 — Permissões do gestor em Configurações

Pedido: administrador configura e analisa tudo; o gestor (que também pode ser vendedor) mexe só em cadência e follow-ups; meta olímpica, metas de fechamento/contrato, B2B/B2C e demais configurações são só do administrador; vendedor não mexe em metas.

## O que mudou
- `lib/access.ts` → novo `isManager` (administrador ou gestor).
- `components/AppSidebar.tsx`, `app/(app)/layout.tsx` → "Configurações" aparece para administrador e gestor (`managerOnly`); vendedor não vê nem acessa.
- `configuracoes/page.tsx`, `ConfigManager.tsx` → gestor vê só **Cadência do Diário** e **Follow-ups por etapa**; Perfil do negócio, Meta olímpica e Metas do mês aparecem só para o administrador.
- `saveCadence`, ações de follow-up (`tarefas/followup-actions.ts`), página Tarefas e botão do Diário → permitidos a administrador e gestor; `saveBusinessProfile`, `saveOlympicGoals`, `saveCrmGoals`, `saveMemberSalesGoals` continuam só do administrador.
- Banco: políticas novas deixam o gestor gravar `crm_followup_rules` e as metas de cadência em `crm_goals` (`daily_approaches`, `weekly_approaches`, `weekly_new_leads`, `weekly_ad_leads`, `daily_ad_replies`); o resto segue só do administrador.

## Banco
Rodar `supabase/migrations/006_permissoes_gestor.sql` (também em `schema.sql`). Pode rodar mais de uma vez.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Teste de RLS no Postgres local: gestor altera cadência e follow-up; é barrado em meta olímpica, outras metas e perfil do negócio; vendedor é barrado em tudo. Não testado no navegador.
