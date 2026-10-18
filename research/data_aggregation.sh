#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"
if [[ "${CONSULTATION_NIX_ENV:-}" != "1" ]]; then
    exec nix develop "path:${SCRIPT_DIR}" --command bash "${SCRIPT_DIR}/data_aggregation.sh" "$@"
fi
exec python -m consultations "$@"
