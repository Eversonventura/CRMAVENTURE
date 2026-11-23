# Sprint 14 — Aba Configurações (só o administrador)

Pedido: criar a aba Configurações, só para o administrador (cliente): modelo comercial
(B2B ou B2C), segmento do negócio, a cadência do Diário (antes "metas do Diário"), a
meta olímpica (faturamento ou contratos) e os follow-ups.

## O que mudou
- `crm/configuracoes/page.tsx`, `ConfigManager.tsx` (novos) → página com quatro seções: **Perfil do negócio** (modelo B2B/B2C e segmento), **Cadência do Diário** (novas abordagens por dia e leads novos por semana), **Meta olímpica** (por faturamento ou por contratos, com os alvos de cada medalha) e **Follow-ups por etapa** (tarefa, em quantos dias, repetir, meta por dia, ativa). Quem não é administrador vê "Sem permissão"; o item do menu só aparece para o administrador.
- `crm/business.ts` (novo) → modelos e lista de segmentos (agência de marketing, indústria, fábrica, serviços, direito, clínica, estética, loja, alimentação, educação, imobiliária, construção, tecnologia, contabilidade, outro) e a regra `showCompanyOnlineFields` (redes sociais e site só em B2B de agência de marketing; usada na Sprint 16). `crm/settings.ts` lê as configurações.
- `crm/configuracoes/actions.ts` → `saveBusinessProfile` (só administrador).
- `crm/configuracoes/OlympicSettingsForm.tsx`, `FollowupRulesSection.tsx` → a meta olímpica e as regras de follow-up, que estavam em modais, viraram seções da página.
- Saíram dos lugares antigos: botão "Metas" do Diário (agora "Configurar cadência", um link para Configurações), botão e janela de follow-ups em Tarefas (agora um link), e a parte olímpica da janela de Metas da Visão Geral (ficam lá as metas de KPIs e por vendedor).
- `components/AppSidebar.tsx` → item Configurações (só administrador). `components/NoPermission.tsx` (novo).
- `supabase/schema.sql`, `supabase/migrations/003_configuracoes.sql` → tabela `crm_settings` (uma linha por conta: `business_model` b2b/b2c e `segment`), leitura para membros e escrita só do administrador; `seed_workspace_defaults` passa a criar a linha da conta nova (B2B, sem segmento). Contas que já existem ficam como B2B de "agência de marketing", para manter o comportamento de hoje.

## Banco
**Rodar `supabase/migrations/003_configuracoes.sql`** no SQL Editor. Sem ela a página abre, mas salvar o perfil do negócio dá erro. A função `seed_workspace_defaults` mantém a mesma assinatura (contrato com o Hub).

## Verificação
`npx tsc --noEmit` e `next build` limpos. Testado em Postgres local: schema novo; banco antigo + migration 003 (conta existente vira B2B de agência). Tela renderizada com o componente real. Não testado: salvar cada seção no navegador contra o Supabase; efeito do modelo/segmento nos formulários (Sprint 16).
