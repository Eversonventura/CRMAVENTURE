# Sprint 25 — Cadência com leads de anúncio

Pedido: na cadência do Diário, além das abordagens por dia, ter abordagens por semana, meta de leads de anúncio e responder leads de anúncio (quem vive de anúncio não faz muita abordagem); follow-ups acompanham as etapas do fluxo.

## O que mudou
- `configuracoes/actions.ts` → `saveCadence`: grava cinco metas da conta (`daily_approaches`, `weekly_approaches`, `weekly_new_leads`, `weekly_ad_leads`, `daily_ad_replies`) em `crm_goals`; só administrador.
- `configuracoes/ConfigManager.tsx` + `page.tsx` → a seção Cadência ganhou: Novas abordagens por dia, Abordagens por semana, Leads novos por semana, Leads de anúncio por semana (meta de captação) e Responder leads de anúncio por dia (0 = sem meta). Salva com confirmação.
- `diario/page.tsx` + `DiarioView.tsx` → "Semana: X de Y abordagens" na seção de abordagens e nova seção **Responder leads de anúncio**: lista os leads do canal "Tráfego pago" ainda sem primeiro contato, com progresso do dia, leads de anúncio recebidos na semana contra a meta e botão "Respondi" (usa o mesmo registro de abordagem).
- Follow-ups por etapa: a lista já mostrava todas as etapas abertas do fluxo; agora criar/renomear etapa também revalida Configurações e Tarefas, e o texto da seção avisa que etapa nova entra sozinha.

## Banco
Não muda schema (usa `crm_goals` com métricas novas).

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado no navegador contra o Supabase real.
