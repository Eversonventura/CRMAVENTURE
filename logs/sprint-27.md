# Sprint 27 — Acesso com senha temporária (sem link, sem e-mail)

Pedido: o link de acesso continuava dando "expirou ou já foi usado" mesmo sem ninguém ter aberto antes.

## O que mudou
- `lib/workspace-actions.ts` → `provisionTempAccess`: cria o login (ou, se a pessoa nunca entrou, redefine) com uma senha temporária e e-mail já confirmado, usando a chave de serviço. Sem token, sem link, sem SMTP, sem prazo. Só para quem nunca fez login (um administrador não assume o acesso de quem já entrou). O gatilho `handle_new_user` coloca a pessoa na conta.
- `inviteMember` → se o e-mail não sai, devolve e-mail + senha temporária; `generateAccessLink` (botão "Gerar acesso (senha)" na lista de pessoas) faz o mesmo para convidados que ainda não entraram.
- `AccountManager.tsx` → mostra o texto pronto (endereço, e-mail, senha temporária), com Copiar e Enviar por WhatsApp; orienta a trocar a senha em Perfil.
- O trecho de `token_hash` em `/auth/callback` (Sprint 23) continua no código, sem uso por enquanto.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado contra o Supabase real (criação do login e entrada com a senha temporária).
