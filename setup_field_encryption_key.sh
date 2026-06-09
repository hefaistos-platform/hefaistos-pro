#!/usr/bin/env bash
set -euo pipefail

# Generates a Fernet key and writes it to .secrets/field_key
# Run from repo root: ./setup_field_encryption_key.sh [--force]
# The backend reads this secret via Docker secrets mounted at /run/secrets/field_key

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="${ROOT_DIR}/.secrets"
KEY_FILE="${SECRETS_DIR}/field_key"
FORCE=0

if [[ "${1-}" == "--force" ]]; then
  FORCE=1
fi

mkdir -p "${SECRETS_DIR}"

if [[ -s "${KEY_FILE}" && ${FORCE} -ne 1 ]]; then
  echo "Key already exists at ${KEY_FILE}. Use --force to overwrite."
  exit 0
fi

if [[ -f "${KEY_FILE}" && ! -s "${KEY_FILE}" ]]; then
  echo "Existing key file at ${KEY_FILE} is empty; regenerating it."
fi

# Try generating the key using Python + cryptography first
generate_with_python() {
  local _python_bin="$1"
  "${_python_bin}" - <<'PY' || return 1
try:
    from cryptography.fernet import Fernet
    print(Fernet.generate_key().decode(), end='')
except Exception:
    raise SystemExit(1)
PY
}

# Fallback: generate 32 random bytes and urlsafe-base64 encode via openssl
# Then translate +/ -> -_ to make it urlsafe, keep padding '='
generate_with_openssl() {
  if ! command -v openssl >/dev/null 2>&1; then
    return 1
  fi
  # openssl -base64 wraps lines at 64 chars; disable wrapping with -A if available
  if openssl enc -base64 -A </dev/null >/dev/null 2>&1; then
    openssl rand 32 | openssl enc -base64 -A | tr '+/' '-_' | tr -d '\n'
  else
    openssl rand 32 | openssl enc -base64 | tr -d '\n' | tr '+/' '-_'
  fi
}

KEY=""

# Prefer python3, then python
if command -v python3 >/dev/null 2>&1; then
  if KEY=$(generate_with_python python3); then :; fi
fi
if [[ -z "${KEY}" ]] && command -v python >/dev/null 2>&1; then
  if KEY=$(generate_with_python python); then :; fi
fi

# Fallback to OpenSSL method
if [[ -z "${KEY}" ]]; then
  if KEY=$(generate_with_openssl); then :; else
    echo "Error: Could not generate key. Install Python (with cryptography) or OpenSSL." >&2
    exit 1
  fi
fi

# Basic sanity: Fernet keys are typically 43-44 chars including padding
if [[ ${#KEY} -lt 40 ]]; then
  echo "Error: Generated key length (${#KEY}) looks invalid." >&2
  exit 1
fi

printf "%s" "${KEY}" > "${KEY_FILE}"
chmod 600 "${KEY_FILE}" || true

cat <<EOF
Field encryption key written to: ${KEY_FILE}

Next steps:
  - Ensure docker compose mounts this file (already configured).
  - Restart backend to load the key:
      docker compose up -d backend
EOF
