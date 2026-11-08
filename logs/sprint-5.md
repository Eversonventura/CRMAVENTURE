# Sprint 5 — Perfil do usuário (foto, nome, e-mail, senha, contas)

Pedido: o avantecrm será aberto a partir de uma área de membros e precisa de
uma área de perfil: avatar por membro, ver qual e-mail está logado, trocar
nome e senha e ver de qual empresa (conta) a pessoa está acessando.

## O que mudou
- `app/(app)/perfil/page.tsx`, `ProfileManager.tsx` (novos) → página "Meu perfil":
  - foto: envia (recortada em quadrado e reduzida a 256 px no navegador), troca e remove;
  - nome editável; e-mail de acesso (somente leitura: é o login e o e-mail dos convites);
  - "Minhas contas (empresas)": todas as contas da pessoa, papel em cada uma, dono ou convidado, conta ativa marcada e botão "Usar esta conta";
  - senha: pede a atual, confere, e troca (mínimo 8 caracteres).
- `components/Avatar.tsx` (novo) → foto ou iniciais.
- `components/AppHeader.tsx`, `app/(app)/layout.tsx` → avatar e nome no cabeçalho, levam ao perfil.
- `app/(app)/conta/*` → avatar de cada pessoa na lista de quem tem acesso.
- `lib/workspace-actions.ts` → `setMyPhoto` (só aceita URL do bucket `avatars` na pasta da própria pessoa).
- O Funil já mostrava a foto do responsável; ela passa a aparecer lá também.

## Banco
Rodar `supabase/migrations/001_perfil_foto.sql` no SQL Editor (bancos que já têm o `schema.sql`): cria o bucket público `avatars` (cada pessoa grava só na própria pasta) e a função `set_my_photo`. `supabase/schema.sql` já inclui o mesmo para bancos novos.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Schema completo aplicado em Postgres 16 local; `set_my_photo` e `update_my_profile` testadas (foto e nome replicam para todas as contas da pessoa; limpar a foto funciona). Não testado no navegador contra o Supabase real: envio da foto e troca de senha dependem da migration aplicada.

## Fora do escopo (próximos passos)
- Troca de e-mail de login (afeta convites e vínculos).
- Entrada pela área de membros (login único / abrir dentro da área): precisa saber qual plataforma de membros e se será em iframe ou em nova aba.
