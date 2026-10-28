# Sprint 1 — Cadastro e login mostram o erro real

Pedido (implícito): ao publicar, o cadastro falhava com "Não foi possível
criar a conta" sem dizer por quê.

## O que mudou
- `app/cadastro/SignUpForm.tsx`, `app/login/LoginForm.tsx` → a mensagem inclui o texto do erro do Supabase. Isso permitiu achar as duas causas de configuração: chave anon inválida na Vercel e "Email signups are disabled" no Supabase.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` limpo; cadastro funcionando em produção após corrigir as configurações.

## Configuração (não é código)
Supabase → Authentication → Providers → Email: provedor e "Allow new users to sign up" ligados; Site URL = URL da Vercel. Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
