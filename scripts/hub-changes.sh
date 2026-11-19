#!/usr/bin/env bash
# Lista o que mudou no Aventure Hub que pode precisar vir para o avantecrm,
# desde o último commit sincronizado (logs/HUB-SYNC.md).
#   scripts/hub-changes.sh                 # desde o último sincronizado
#   scripts/hub-changes.sh --since <hash>  # desde outro ponto (ex.: teste)
# O clone do Hub fica em $HUB_DIR (padrão /home/user/aventure-hub).
set -euo pipefail
cd "$(dirname "$0")/.."

HUB_DIR="${HUB_DIR:-/home/user/aventure-hub}"
SINCE=""
if [ "${1:-}" = "--since" ]; then SINCE="${2:?informe o hash}"; fi
if [ -z "$SINCE" ]; then
  SINCE=$(grep -m1 '^ULTIMO_COMMIT_SINCRONIZADO=' logs/HUB-SYNC.md | cut -d= -f2 | tr -d '[:space:]')
fi
[ -n "$SINCE" ] || { echo "Não achei ULTIMO_COMMIT_SINCRONIZADO em logs/HUB-SYNC.md." >&2; exit 1; }
[ -d "$HUB_DIR/.git" ] || { echo "Clone do Hub não encontrado em $HUB_DIR (defina HUB_DIR)." >&2; exit 1; }

# Busca o histórico até o ponto de partida (o clone pode ser raso).
git -C "$HUB_DIR" fetch -q origin main 2>/dev/null || true
if ! git -C "$HUB_DIR" cat-file -e "$SINCE^{commit}" 2>/dev/null; then
  git -C "$HUB_DIR" fetch -q --depth=1000 origin main
fi
HEAD_HASH=$(git -C "$HUB_DIR" rev-parse --short origin/main)

CRM_PATH='app/(admin)/crm'
echo "Hub: $SINCE → $HEAD_HASH"
echo
echo "== Commits que mexeram no CRM ($CRM_PATH)"
git -C "$HUB_DIR" log --reverse --format='%h %ci %s' "$SINCE..origin/main" -- "$CRM_PATH" | sed 's/^/  /'
echo
echo "== Migrations novas do Hub que citam tabelas do CRM (conferir se precisam de migration aqui)"
git -C "$HUB_DIR" log --reverse --format='%h %s' -G'crm_(opportunities|stages|companies|contacts|tasks|pipelines|followup|goals|activities|daily|off|proposals|cadence)' "$SINCE..origin/main" -- supabase/migrations | sed 's/^/  /'
echo
echo "== Arquivos do CRM alterados"
git -C "$HUB_DIR" diff --stat "$SINCE" origin/main -- "$CRM_PATH" | sed 's/^/  /'
echo
echo "Para aplicar um commit: scripts/hub-port.sh <hash>   (depois: registrar em logs/HUB-SYNC.md)"
