# Sprint 34 — Importação de planilha com mapeamento completo

Pedido: importar a planilha de leads que a equipe já usa (Nome, Telefone, Dia de entrada, Observação, Prioridade, Origem, Comentários e atividade), reconhecendo as colunas e levando cada uma para o campo certo do CRM, em B2C e B2B.

## O que mudou
- `contatos/import-parse.ts` → novos campos mapeáveis: Data de entrada, Origem, Prioridade, Temperatura, Observação interna, Comentários e atividade, Etapa, Responsável e Valor estimado. O reconhecimento automático das colunas (sem acento, sem maiúsculas) cada campo para uma coluna só; a lista mostrada respeita a conta (B2C sem campos de empresa, redes e site só agência, sem valor no modo contratos). Limite subiu de 500 para 1000 linhas. Conversores de data (17/09/2026, 17/09/26, 2026-09-17; dia inexistente é recusado) e de valor (1.500,00, R$ 1500).
- `contatos/actions.ts` (`confirmImport`) → grava cada coluna no campo certo: data de entrada em `created_at`/`entered_at` (relatórios e dias parado contam da data real), origem casada com as origens da conta (o que não casa fica como veio e é avisado), prioridade, temperatura, observação (observação interna da empresa), etapa e responsável por nome, e "Comentários e atividade" como anotação na linha do tempo (com a data de entrada; anotação não conta como primeiro contato). Lead sem nome e com telefone entra como "Lead <telefone>"; "~", "-" e vazio são tratados como sem informação. Telefone ou WhatsApp que já existem não duplicam (importar de novo é seguro). Em B2C cada pessoa é um cliente próprio (nomes iguais não se misturam).
- `contatos/ImportModal.tsx` → importa em lotes de 25 linhas com andamento ("Importando 50 de 200…"), então planilhas grandes não estouram o tempo do servidor; o resumo mostra importados, repetidos, ignorados e origens fora da lista.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` limpo. Teste do reconhecimento com os cabeçalhos da planilha enviada (Nome, Telefone, Dia de entrada, OBSERVAÇÃO, PRIORIDADE, ORIGEM, Comentários e atividade): todas reconhecidas; datas e valores convertem certo. NÃO testado: importação de ponta a ponta no navegador contra o Supabase real, nem o filtro de duplicados por telefone. Riscado/tachado do Excel não é lido (todas as linhas entram).
