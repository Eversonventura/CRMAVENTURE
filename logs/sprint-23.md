# Sprint 23 — Link de acesso que não "gasta" e novo link para quem ainda não entrou

Pedido: o link gerado abriu a tela "Este link expirou ou já foi usado".

## O que mudou
- `lib/workspace-actions.ts` → `buildAccessLink`: o link agora aponta para o próprio CRM (`/auth/callback?token_hash=…&type=…`) em vez do link direto do Supabase. O token só é validado quando a pessoa abre a página, então prévia do WhatsApp ou antivírus de e-mail não gastam o link (o link direto é de uso único).
- `app/auth/callback/page.tsx` → trata `token_hash` com `verifyOtp` e segue para `/auth/definir-senha`.
- `generateAccessLink(memberId)` (novo) + botão "Novo link de acesso" na lista de pessoas: gera outro link para quem foi convidado e ainda não entrou. Só administrador, só pessoa da conta ativa e só quem **nunca fez login** (um administrador não consegue entrar como outra pessoa).

## Banco
Não muda schema. A validade do token segue a configuração do Supabase (Authentication → Providers → Email → expiração do OTP; padrão 1 h, máximo 24 h).

## Verificação
`npx tsc --noEmit` limpo. Não testado contra o Supabase real (geração do link e login pelo link).
