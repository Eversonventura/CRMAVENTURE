#!/usr/bin/env bash
# Aplica no avantecrm o diff de um (ou mais) commit(s) do Hub, só da parte do CRM:
# troca o caminho app/(admin)/crm por app/(app)/crm e ignora arquivos de teste.
# Hunks que não encaixam ficam em arquivos .rej para resolver à mão. Aplique em ordem.
#   scripts/hub-port.sh <hash> [<hash>...]
set -euo pipefail
cd "$(dirname "$0")/.."
HUB_DIR="${HUB_DIR:-/home/user/aventure-hub}"
[ $# -ge 1 ] || { echo "uso: scripts/hub-port.sh <hash> [<hash>...]" >&2; exit 1; }
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
for c in "$@"; do
  echo "== $c  $(git -C "$HUB_DIR" log -1 --format=%s "$c")"
  git -C "$HUB_DIR" show "$c" --format= -- 'app/(admin)/crm' ':!app/(admin)/crm/**/*.test.ts' | sed 's#app/(admin)/crm#app/(app)/crm#g' > "$tmp"
  if [ ! -s "$tmp" ]; then echo "   (nada do CRM neste commit)"; continue; fi
  git apply --whitespace=nowarn --reject -v "$tmp" 2>&1 | grep -E "Applied|error|Rejected|rejected|Checking" | sed 's/^/   /' || true
done
echo
echo "Confira: git status; procure *.rej; rode npx tsc --noEmit e npm run build."
