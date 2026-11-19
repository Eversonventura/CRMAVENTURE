# Sprint 9 — Sincronização assistida com o CRM do Hub (Opção A)

Pedido: trazer as atualizações feitas no CRM do Hub e ter um jeito de manter
o avantecrm em dia a cada nova atualização lá.

## O que mudou
- `logs/HUB-SYNC.md` (novo) → registro: ponto atual (`ULTIMO_COMMIT_SINCRONIZADO=768bd0f`), passo a passo da sincronização, **contrato com o Hub** (nomes do banco que o Desbrava usa para criar e ler contas) e o estado de cada um dos 11 commits do CRM do Hub desde a cópia (trazido / já resolvido / não trazer).
- `scripts/hub-changes.sh` (novo) → lista os commits do Hub que mexeram no CRM desde o ponto atual, as migrations do Hub que citam tabelas do CRM e os arquivos alterados (`--since <hash>` para outro ponto).
- `scripts/hub-port.sh` (novo) → aplica o diff do CRM de um ou mais commits do Hub, trocando `app/(admin)/crm` por `app/(app)/crm` e ignorando testes; o que não encaixa vira `.rej`.
- `CLAUDE.md` → regras de sincronização (quando o usuário pedir, ou mencionar que atualizou o CRM no Hub) e o contrato com o Hub, para valer em sessões futuras.

## Banco
Não muda schema.

## Verificação
Scripts testados: a partir do ponto atual a lista sai vazia; a partir de `8b139b8` lista exatamente os 11 commits do CRM, batendo com a tabela do registro; commit sem CRM é ignorado; reaplicar um commit já aplicado acusa conflito sem alterar arquivos. Sem fluxo automático (Opção B): depende de um token do GitHub guardado no Hub.
