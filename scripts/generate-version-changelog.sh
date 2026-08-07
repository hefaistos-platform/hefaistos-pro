#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/generate-version-changelog.sh --version <version> --range <git-range> [--output <path>]

Examples:
  scripts/generate-version-changelog.sh --version 1.5.2 --range abc123..def456
  scripts/generate-version-changelog.sh --version v1.5.2 --range v1.5.1..v1.5.2 --output Versions/1.5.2.md
EOF
}

VERSION=""
COMMIT_RANGE=""
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --range)
      COMMIT_RANGE="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${VERSION}" || -z "${COMMIT_RANGE}" ]]; then
  usage
  exit 1
fi

NORMALIZED_VERSION="${VERSION#v}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/versioning.sh" validate "${NORMALIZED_VERSION}" >/dev/null

if [[ -z "${OUTPUT_FILE}" ]]; then
  OUTPUT_FILE="Versions/${NORMALIZED_VERSION}.md"
fi

mkdir -p "$(dirname "${OUTPUT_FILE}")"

changes_block=""
fixes_block=""
removals_block=""
changes_count=0
fixes_count=0
removals_count=0
total_commits=0

while IFS=$'\t' read -r commit_hash commit_author commit_subject; do
  [[ -z "${commit_hash}" ]] && continue
  total_commits=$((total_commits + 1))

  entry="\`${commit_hash}\` (${commit_author}) ${commit_subject}"
  lower_subject="$(printf '%s' "${commit_subject}" | tr '[:upper:]' '[:lower:]')"

  if printf '%s\n' "${lower_subject}" | grep -Eq '^fix(\([^)]+\))?:'; then
    fixes_block+="- ${entry}"$'\n'
    fixes_count=$((fixes_count + 1))
  elif printf '%s\n' "${lower_subject}" | grep -Eq '^(remove|removal|delete|drop)(\([^)]+\))?:' \
    || printf '%s\n' "${lower_subject}" | grep -Eq '(^|[[:space:]])(remove|removed|removes|delete|deleted|drop|dropped)([[:space:]]|$)' \
    || [[ "${commit_subject}" == *"!:"* ]]; then
    removals_block+="- ${entry}"$'\n'
    removals_count=$((removals_count + 1))
  else
    changes_block+="- ${entry}"$'\n'
    changes_count=$((changes_count + 1))
  fi
done < <(git log --no-merges --format='%h%x09%an%x09%s' "${COMMIT_RANGE}")

authors="$(git log --no-merges --format='%an' "${COMMIT_RANGE}" | sed '/^$/d' | sort -u | paste -sd ',' - | sed 's/,/, /g')"
areas="$(git log --no-merges --name-only --format='' "${COMMIT_RANGE}" | sed '/^$/d' | awk -F/ '{print $1}' | sort -u | paste -sd ',' - | sed 's/,/, /g')"

if [[ -z "${authors}" ]]; then
  authors="None"
fi

if [[ -z "${areas}" ]]; then
  areas="None"
fi

print_section() {
  local title="$1"
  local content="$2"

  echo "## ${title}"
  if [[ -z "${content}" ]]; then
    echo "- None"
  else
    printf '%s' "${content}"
  fi
  echo
}

{
  echo "# ${NORMALIZED_VERSION}"
  echo
  echo "_Generated on $(date -u +'%Y-%m-%d %H:%M UTC') from range \`${COMMIT_RANGE}\`_"
  echo
  echo "## Summary"
  echo "- What: ${total_commits} commit(s) included in this version."
  echo "- Why: ${changes_count} change(s), ${fixes_count} fix(es), ${removals_count} removal(s)."
  echo "- Who: ${authors}."
  echo "- Where: ${areas}."
  echo

  print_section "Changes" "${changes_block}"
  print_section "Fixes" "${fixes_block}"
  print_section "Removals" "${removals_block}"
} > "${OUTPUT_FILE}"

echo "${OUTPUT_FILE}"
