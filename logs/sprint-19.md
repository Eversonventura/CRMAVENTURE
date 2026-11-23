# Sprint 19 — Metas do mês só em Configurações

Pedido: o botão "Metas" da Visão Geral sai; as metas ficam somente em Configurações.

## O que mudou
- `visao-geral/page.tsx` → removidos o botão e o modal "Metas"; texto de apoio aponta para Configurações → Metas do mês.
- `GoalsEditor.tsx` (modal) → substituído por `GoalsForm.tsx`, o mesmo formulário (metas da equipe + metas de vendas por vendedor) direto na página, com botão "Salvar metas".
- `configuracoes/page.tsx` e `ConfigManager.tsx` → nova seção "Metas do mês" (id `metas`), só administrador; carrega metas da equipe, metas por vendedor e lista de vendedores.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` (com variáveis do Supabase de mentira) limpos. Não testado no navegador contra o Supabase real.
