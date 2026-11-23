# Sprint 20 — Convite de compartilhamento envia e-mail

Pedido: ao compartilhar a conta com um e-mail, nenhum e-mail chegava.

## O que mudou
- `lib/workspace-actions.ts` (`inviteMember`) → antes só gravava no banco, sem enviar nada.
  - Pessoa **sem login**: `auth.admin.inviteUserByEmail` (chave de serviço) manda o e-mail do Supabase com link para `/auth/callback` → `/auth/definir-senha`; ao criar o usuário, `handle_new_user` já a coloca na conta.
  - Pessoa **com login**: entra na conta na hora; se houver `RESEND_API_KEY`, recebe aviso por e-mail; sem ele, a mensagem na tela diz que nada foi enviado e que ela escolhe a conta no seletor.
  - Se o envio falhar, o convite continua registrado e a tela mostra o motivo.

## Banco
Não muda schema. Requer `SUPABASE_SERVICE_ROLE_KEY` na Vercel e, para o e-mail do Supabase chegar a qualquer pessoa, SMTP próprio configurado no Supabase (o envio padrão só entrega para membros do projeto e tem limite baixo).

## Verificação
`npx tsc --noEmit` e `npm run build` limpos. Não testado com envio real de e-mail.
