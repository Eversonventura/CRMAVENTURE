# Sprint 17 — Aba Mensagens (modelos sugeridos no card do lead)

Pedido: uma aba de mensagens automáticas, com configurações para sugestão de mensagem de
tentativa de contato, follow-up, indicação ou outro tipo.

## O que mudou
- `crm/mensagens/page.tsx`, `MessagesManager.tsx`, `actions.ts` (novos) → aba **Mensagens** no menu, com os modelos agrupados em Tentativa de contato, Follow-up, Indicação e Outras mensagens. Todos do time veem; **só o administrador cria, edita, ativa/desativa e exclui**. Variáveis no texto, com botões para inserir: `{nome}` (primeiro nome do contato), `{empresa}` e `{vendedor}` (quem está enviando).
- `crm/messages.ts` (novo) → tipos de mensagem, `fillTemplate` (preenche as variáveis e arruma espaços antes de pontuação; sem nome de contato usa o nome inteiro da empresa) e `suggestedKind` (lead em "Lead" sugere Tentativa de contato; demais etapas, Follow-up).
- `funil/MessageSuggestions.tsx` (novo), usado em `OpportunityModal.tsx` → no card do lead (Funil, Diário e Contatos), acima da linha do tempo: escolhe o tipo e o modelo, o texto já vem preenchido e pode ser ajustado, com **Copiar** e **Abrir no WhatsApp** (link com o texto pronto). Os modelos são buscados uma vez por sessão do navegador.
- `components/AppSidebar.tsx` → item Mensagens.
- `supabase/schema.sql` e `supabase/migrations/005_mensagens.sql` → tabela `crm_message_templates` (por conta; leitura para membros, escrita só do administrador), função interna `seed_message_templates` com 6 modelos padrão (2 de tentativa, 2 de follow-up, 1 de indicação, 1 agradecimento) e `seed_workspace_defaults` passa a chamá-la (mesma assinatura: contrato com o Hub). Contas que já existem ganham os modelos padrão pela migration.
- Não envia nada sozinho: é sugestão para o vendedor copiar ou abrir no WhatsApp. (Envio automático exigiria a API do WhatsApp, em planejamento à parte.)

## Banco
**Rodar `supabase/migrations/005_mensagens.sql`** no SQL Editor. Sem ela, a aba abre vazia e o card mostra "Nenhum modelo ativo".

## Verificação
`npx tsc --noEmit` e `next build` limpos. Postgres local: schema novo cria 6 modelos na conta nova; banco anterior + migration 005 cria 6 modelos na conta existente. `fillTemplate` e `suggestedKind` testados por script. Componentes testados num navegador (Chromium) com dados simulados: tipo inicial pela etapa, troca de tipo e de modelo, preenchimento do nome e do vendedor, copiar e link do WhatsApp com o texto. Não testado contra o Supabase real nem o salvar/editar/excluir modelos.
