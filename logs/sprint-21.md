# Sprint 21 — Link de convite quando o e-mail não sai (100% gratuito)

Pedido: seguir no plano gratuito; o e-mail do Supabase (SMTP do Gmail) continuava falhando.

## O que mudou
- `lib/workspace-actions.ts` (`inviteMember`) → se `inviteUserByEmail` falha, gera o link de acesso com `auth.admin.generateLink` (`invite`, e `magiclink` se o usuário já foi criado pela tentativa) e devolve o link junto da mensagem.
- `app/(app)/conta/AccountManager.tsx` → o aviso mostra o link com "Copiar link" e "Enviar por WhatsApp". O link leva a `/auth/callback` → `/auth/definir-senha`; ao criar o usuário o gatilho já coloca a pessoa na conta.

## Banco
Não muda schema. Link vale por pouco tempo (padrão do Supabase: 1 hora; ajustável em Authentication → Providers → Email → expiração do OTP).

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado contra o Supabase real.
