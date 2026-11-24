# Índice de Sprints

| Módulo / assunto | Sprint |
|---|---|
| Base do sistema: CRM copiado do Aventure Hub como sistema independente, contas compartilháveis (convite por e-mail, papéis), login/cadastro, Recebimentos, cron de automações, schema único | 0 |
| Cadastro e login mostram a mensagem real do erro do Supabase (em vez de texto genérico) | 1 |
| Processo: sprints numeradas + logs (`CLAUDE.md`, `logs/`) | 2 |
| Logo avantecrm (login, cadastro, cabeçalho) e rodapé "Powered by Aventure" em todas as telas | 3 |
| Metas de vendas: meta de fechamentos e receita por vendedor (editor de Metas), painel "Vendas e fechamentos" na Visão geral, card "Vendas no mês" no Diário, cartões de venda primeiro | 4 |
| Perfil: página "Meu perfil" (foto, nome, e-mail de acesso, troca de senha, minhas contas/empresas), avatar no cabeçalho, no Funil e na lista de pessoas da conta; migration 001_perfil_foto | 5 |
| Meta olímpica: marcos Bronze/Prata/Ouro/RMV em escada (sem sobreposição) e legenda de valores no celular | 6 |
| Hub → avantecrm, lote 1: Excluir lead, Diário prioriza lead com telefone, contato cadastrado/importado entra em Novo lead, etapas do funil com títulos mais claros | 7 |
| Meta olímpica por vendas fechadas (regra do Hub) com escolha de medir por valor ou por contratos fechados; gráficos na Visão geral | 8 |
| Sincronização assistida com o Hub: registro (logs/HUB-SYNC.md), scripts hub-changes/hub-port, regras e contrato com o Desbrava no CLAUDE.md | 9 |
| Hub → avantecrm (24ae357): Funil mostra fechados e perdidos por 3 meses e arrastar de volta reabre a oportunidade | 10 |
| Hub → avantecrm (24ae357..6b6c598): meta olímpica com banner, confete e caixas por medalha; venda recorrente usa a mensalidade; desconto na 1ª mensalidade; cartões de metas com destaque; card perdido na hora | 11 |
| Só o Hub cria contas: removido "Outra conta" da tela e a função create_workspace do banco (migration 002) | 12 |
| Menu lateral no lugar do cabeçalho e das abas; sem o texto "CRM" ao lado da logo; aba Recebimentos removida | 13 |
| Aba Configurações (só administrador): perfil do negócio (B2B/B2C e segmento), cadência do Diário, meta olímpica por faturamento ou contratos e follow-ups; migration 003 | 14 |
| Funil padrão enxuto para contas novas (Lead, Contato realizado, Fechamento, Perdido); cartão de propostas some sem etapa de proposta; migration 004 | 15 |
| Formulário único de contato e oportunidade (Funil e Contatos) por B2B/B2C e segmento; site e redes só para agência; ações gravam só os campos enviados | 16 |
| Aba Mensagens: modelos de tentativa de contato, follow-up, indicação e outros (administrador edita); sugestão no card do lead com copiar e abrir no WhatsApp; migration 005 | 17 |
| Renomeado "Funil" para "Fluxo" em todos os textos (menu, telas, metadados); rota e código internos mantidos | 18 |
| Botão Metas sai da Visão Geral; metas do mês (equipe e por vendedor) viram seção em Configurações | 19 |
| Compartilhar conta envia e-mail: convite do Supabase para quem não tem login; aviso (Resend) para quem já tem | 20 |
| Convite mostra o link de acesso (copiar / WhatsApp) quando o e-mail não sai, sem depender de SMTP | 21 |
| Configurações: salvar confirma lendo de volta, nunca trava, sempre mostra mensagem; leitura filtra pela conta | 22 |
| Link de acesso passa pelo CRM (token_hash) e não é gasto por prévia; botão Novo link de acesso para quem ainda não entrou | 23 |
| Modo contratos no sistema todo: conta fechamento sem valor, fluxo/Diário/Visão Geral/metas sem preço, Contrato fechado sem modal de pagamento | 24 |
| Cadência: abordagens por semana, meta de leads de anúncio e responder leads de anúncio (Configurações + Diário); follow-ups acompanham as etapas do fluxo | 25 |
| Meta e cartão Leads de anúncio recebidos (Metas do mês e Visão Geral) | 26 |
