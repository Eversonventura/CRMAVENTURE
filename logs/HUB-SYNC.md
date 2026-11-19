# Sincronização com o CRM do Aventure Hub

O avantecrm nasceu como cópia do módulo CRM do Hub (`aventure-hub`, pasta
`app/(admin)/crm`, ponto de partida `8b139b8`, 21/10/2026). Os dois códigos
**divergiram de propósito** (contas compartilháveis, login próprio, perfil,
Recebimentos, metas por vendedor; sem Clientes, Financeiro, Anúncios, WhatsApp,
Serviços pontuais), então as atualizações do Hub não são copiadas por cima:
elas são **trazidas por sprint**, com revisão. Este arquivo é o registro.

## Ponto atual

Tudo do CRM do Hub até o commit abaixo já foi avaliado (trazido ou descartado,
conforme a tabela). Atualize esta linha ao terminar cada sincronização.

ULTIMO_COMMIT_SINCRONIZADO=6b6c598

## Como sincronizar (quando o usuário pedir "sincroniza com o Hub")

1. `scripts/hub-changes.sh` — lista os commits do Hub que mexeram no CRM desde o ponto acima, as migrations do Hub que citam tabelas do CRM e os arquivos alterados. (Usa o clone do Hub em `/home/user/aventure-hub`; se não existir, anexe `Eversonventura/aventure-hub` com `add_repo` e clone.)
2. Separe cada commit:
   - **Trazer**: CRM puro (funil, Diário, contatos, tarefas, metas, propostas, Visão geral).
   - **Não trazer**: o que só faz sentido no Hub (Impulso, Desbrava, Clientes, Financeiro, Anúncios, Orçamentos, WhatsApp).
   - **Adaptar**: mexe em algo que mudou aqui (conta/`workspace_id`, Recebimentos, metas por vendedor, perfil). Pense em vendedor: ele só enxerga as próprias oportunidades (RLS).
3. `scripts/hub-port.sh <hash>` (em ordem cronológica) aplica o diff do CRM trocando o caminho; resolva os `.rej` à mão.
4. Se o Hub mudou o banco do CRM, escreva a migration **aqui** (`supabase/migrations/NNN_*.sql` + `supabase/schema.sql`) e peça ao usuário para rodá-la no Supabase.
5. Siga o `CLAUDE.md`: uma sprint por lote (ou por assunto), `npx tsc --noEmit` e `npm run build` limpos, log em `logs/sprint-N.md`, linha em `logs/INDEX.md`.
6. Atualize `ULTIMO_COMMIT_SINCRONIZADO` e a tabela abaixo no mesmo commit.

Opcional (Opção B, ainda não ligada): um fluxo no GitHub do Hub que abre um aviso neste repositório a cada commit que mexer em `app/(admin)/crm`. Precisa de um token do GitHub guardado como segredo no Hub.

## Contrato com o Hub (NÃO quebrar)

A área de membros do Hub (**Desbrava**) cria e lê contas **neste banco** usando a
chave de serviço (`AVANTE_SUPABASE_URL`, `AVANTE_SERVICE_ROLE_KEY`, `AVANTE_URL`;
código em `lib/desbrava/avante/*` do Hub). Ele depende destes nomes. Não renomeie,
remova nem mude o tipo sem combinar e atualizar o Hub junto:

| O que | Quem usa e como |
|---|---|
| gatilho `handle_new_user` em `auth.users` | todo usuário criado ganha `profiles` + conta própria **"Conta de <nome>"** + vínculo administrador + funil padrão; o Hub reconhece a conta automática pelo nome começando com `Conta de ` |
| `profiles.id`, `profiles.email` (minúsculo) | o Hub procura o usuário pelo e-mail |
| `workspaces` (`id`, `name`, `owner_id`, `created_at`) | o Hub cria, renomeia, lista e apaga contas |
| função `seed_workspace_defaults(p_ws uuid)` | o Hub chama ao criar a conta da empresa; mantenha a permissão de execução para `service_role` |
| `team_members` (`workspace_id`, `profile_id`, `full_name`, `email`, `crm_role`), único em `(workspace_id, profile_id)` | o Hub faz upsert; `crm_role` ∈ `administrador` / `gestor` / `vendedor` |
| `crm_opportunities` (`workspace_id`, `status`, `closed_at`, `estimated_value`) | o Hub soma as vendas fechadas por mês (Mapa de Metas e cartão de vendas reais) |
| Auth: criação de usuário com e-mail confirmado e bloqueio (`ban_duration`) | suspensão e reativação de acesso pelo Hub |

## Arquivos que divergem do Hub de propósito (mesclar à mão ao sincronizar)

- `visao-geral/OlympicCard.tsx` e `olympic.ts`: modo da meta olímpica por **valor ou contratos** (só existe aqui); `OlympicBanner` recebe `scope` (conta) para guardar a comemoração por conta.
- `visao-geral/page.tsx`: painel "Vendas e fechamentos" por vendedor, metas por vendedor, sem anúncios/WhatsApp/serviços pontuais.
- `olympic-sales.ts`: sem a origem `pontual`.
- `actions.ts`: excluir lead protege a empresa de vendedor; anexos por conta; e-mail via Resend.

## Estado de cada commit do CRM do Hub (desde `8b139b8`)

| Commit | Assunto | Estado |
|---|---|---|
| `1a46b5b` | Meta olímpica conta vendas fechadas no mês | Trazido — Sprint 8 (+ escolha por valor ou contratos) |
| `876b909` | Legenda dos marcos da meta olímpica sem sobreposição | Já resolvido aqui — Sprint 6 (outra solução: escada) |
| `e2527de` | Botão Excluir lead no card | Trazido — Sprint 7 (vendedor não apaga a empresa) |
| `c636cdf` | Diário prioriza leads com WhatsApp/telefone | Trazido — Sprint 7 |
| `fd37924` | Desbrava: ficha do lead enviada ao CRM | Não trazer (específico do Hub/Desbrava) |
| `bf5eddd` | Contato cadastrado entra no funil em "Novo lead" | Trazido — Sprint 7 |
| `dc3b081` | Lead cadastrado/importado entra em "Novo lead" | Trazido — Sprint 7 |
| `7fe53e6` | Impulso v2: selo no CRM e outros | Não trazer (Impulso é do Hub) |
| `5485feb` | Impulso: fila no Diário e link para o negócio | Não trazer (Impulso é do Hub) |
| `6a0f1d0` | Visão geral com gráficos (pizza e barras) | Trazido — Sprint 8 |
| `768bd0f` | Etapas do funil com títulos e nomes de papel mais claros | Trazido — Sprint 7 |
| `24ae357` | Funil: fechados e perdidos visíveis por 3 meses; arrastar de volta reabre | Trazido — Sprint 10 |
| `893e63f` | Funil: card perdido fica na coluna Perdido na hora | Trazido — Sprint 11 |
| `7ef5ead` | Meta olímpica conta a venda (recorrência usa a mensalidade do fechamento); desconto na 1ª mensalidade | Trazido — Sprint 11 (sem serviços pontuais) |
| `d987e11`, `61313b1`, `ce3ead2`, `ee0f6ea` | Meta olímpica: banner do marco, confete, destaque em cada marco, caixas clicáveis (OlympicBanner/Celebration/TierButton) | Trazido — Sprint 11 (estado final; a "escada" da Sprint 6 foi removida a favor da barra só com traços do Hub) |
| `f3db887` | Visão geral: remove o cartão "Recebido no mês (caixa)" | Trazido — Sprint 11 (o caixa continua em Recebimentos) |
| `6b6c598` | Visão geral: destaque nos cartões de metas (batida / quase lá / abaixo) | Trazido — Sprint 11 |
