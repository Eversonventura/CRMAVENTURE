# Sprint 22 — Configurações: salvar com confirmação e sem travar

Pedido: ao escolher B2C ou o segmento e salvar, a tela voltava para B2B; nas Configurações o botão salvar não mostrava "salvo". Passar um pente fino nos salvamentos.

## O que mudou
- `crm/settings.ts` → a leitura das configurações filtra pela conta ativa (`workspace_id`) e registra no log do servidor se a consulta falhar (antes um erro virava "B2B" em silêncio).
- `configuracoes/actions.ts` (`saveBusinessProfile`) → depois de gravar, lê de volta e só responde "salvo" se o banco confirmar; senão mostra erro com o nome da conta.
- `ConfigManager.tsx`, `OlympicSettingsForm.tsx`, `FollowupRulesSection.tsx` → todo salvar agora usa `try/catch/finally`: o botão nunca fica preso em "Salvando…" e sempre aparece uma mensagem (salvo ou erro). Perfil, cadência e meta olímpica recarregam a página ao salvar.
- Teste local de RLS (Postgres): o upsert de `crm_settings` por administrador, com o cabeçalho da conta, grava e lê de volta corretamente; portanto a causa não era a política do banco.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` limpo. Não reproduzido no navegador contra o Supabase real: se continuar voltando para B2B, a mensagem de erro nova indica o motivo.
