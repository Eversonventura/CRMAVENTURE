# Sprint 38 — Papéis do processo simplificados

Pedido: no "Papel no processo" das etapas deixar só Lead, Prospect, Qualificado, Desqualificado e Stand-by. Lead inclui "tentativa de contato" (ainda não respondeu); respondeu vira prospect; em análise, proposta, negociação e fechamento é qualificado; stand-by é quem não está no momento de compra.

## O que mudou
- `supabase/migrations/011_papeis_simples.sql` (+ `schema.sql`) → novo conjunto de papéis. As etapas que a conta já tem são convertidas sozinhas: tentativa→lead, contato→prospect, briefing/diagnóstico/negociação→qualificado (as regras de follow-up continuam ligadas às mesmas etapas). Conta nova nasce com "Contato realizado" = prospect.
- `crm_opportunity_lifecycle` (gatilho) → sair do lead, ou avançar entre etapas de papel lead (ex.: Lead → Tentativa de contato), conta como primeiro contato. Antes só valia sair do papel lead.
- `types.ts`, `funil/StageManagerModal.tsx`, `funil/stage-actions.ts` → seletor "Papel no processo" com Lead, Prospect, Qualificado, Desqualificado e Stand-by (e "Sem papel especial").
- `actions.ts` (`registerContactAttempt`, o "Abordei") → o lead avança para a próxima etapa de papel lead depois da atual (a antiga "Tentativa de contato"); sem ela, só registra a tentativa. `diario/actions.ts` → "Respondeu" leva ao papel prospect.
- `diario/page.tsx` → follow-ups por etapa agrupados em Lead, Prospect, Qualificado e Stand-by; "Preparação e agendamentos" usa o papel qualificado. `propostas/page.tsx`, `visao-geral/page.tsx` → propostas e o cartão "Propostas apresentadas" usam o papel qualificado (inclui pré-briefing, antes só diagnóstico/proposta).
- `messages.ts` → sugestão inicial de mensagem: lead → tentativa de contato; demais → follow-up.

## Banco
Rodar `supabase/migrations/011_papeis_simples.sql`. Pode rodar mais de uma vez.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Postgres local: banco com as 12 etapas antigas foi convertido (lead,lead,prospect,standby,qualificado…), rodar de novo não dá erro, papel antigo é recusado, conta nova nasce com Lead/Prospect e 1 regra de follow-up; gatilho: Lead→Tentativa e Lead→Prospect marcam primeiro contato, voltar não marca. Não testado no navegador. Ponto de atenção: "Propostas apresentadas" passa a contar todas as etapas qualificadas.
