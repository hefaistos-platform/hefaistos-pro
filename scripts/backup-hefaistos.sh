#!/bin/bash

# =============================================================================
# HEFAISTOS BACKUP SCRIPT
# =============================================================================
# Purpose: Automated backup of Hefaistos database and configuration
# Usage: ./backup-hefaistos.sh [backup_dir] [retention_days]
# Example: ./backup-hefaistos.sh /backups 30
# =============================================================================
#
# Requirements:
#   - docker, docker compose, tar, gzip, sshpass, ssh, scp
#   - Docker Compose stack running (db, backend, elasticsearch services)
#   - SSH credentials in .secrets/backup_credentials file
#
# Setup:
#   1. Create .secrets/backup_credentials with format:
#      REMOTE_USER=backup-user
#      REMOTE_HOST=192.168.1.100
#      REMOTE_PORT=22
#      REMOTE_PASSWORD=your-password-here
#      REMOTE_PATH=/backups/hefaistos
#   2. Run: chmod 600 .secrets/backup_credentials
################################################################################

set -euo pipefail

# ===== CONFIGURATION =====
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUPS_DIR="${REPO_ROOT}/backups"
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_TIME=$(date +%H:%M:%S)
RETENTION_DAYS=30                      # Keep backups for 30 days (configurable)
CREDENTIALS_FILE="${REPO_ROOT}/.secrets/backup_credentials"
LOG_TAG="hefaistos-backup"

# ===== LOGGING FUNCTION =====
log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Log to syslog
  logger -t "$LOG_TAG" -p "user.${level,,}" "$message"
  
  # Also print to console for debugging
  echo "[$timestamp] [$level] $message" >&2
}

# ===== ERROR HANDLER =====
trap 'log ERROR "Backup failed at line $LINENO"; cleanup_on_error; exit 1' ERR
trap 'log INFO "Backup interrupted"; cleanup_on_error; exit 130' INT TERM

cleanup_on_error() {
  log INFO "Cleaning up partial backup directory: ${BACKUPS_DIR}/${BACKUP_DATE}"
  rm -rf "${BACKUPS_DIR:?}/${BACKUP_DATE}" 2>/dev/null || true
}

# ===== PRE-FLIGHT CHECKS =====
preflight_checks() {
  log INFO "Starting preflight checks..."
  
  # Check required commands
  for cmd in docker tar gzip ssh scp sshpass; do
    if ! command -v "$cmd" &> /dev/null; then
      log ERROR "Required command '$cmd' not found in PATH"
      if [ "$cmd" = "sshpass" ]; then
        log ERROR "Install sshpass: apt install sshpass (Debian/Ubuntu) or yum install sshpass (RHEL/CentOS)"
      fi
      return 1
    fi
  done

  # Ensure Compose v2 is available via docker compose
  if ! docker compose version &> /dev/null; then
    log ERROR "Docker Compose v2 not available. Install or upgrade Docker to use 'docker compose'."
    return 1
  fi
  
  # Check Docker Compose stack is running
  cd "$REPO_ROOT"
  if ! docker compose ps --status running db 2>/dev/null | grep -q .; then
    log ERROR "Database container is not running. Start stack with: docker compose up -d"
    return 1
  fi
  
  # Load credentials from .secrets file
  if [ ! -f "$CREDENTIALS_FILE" ]; then
    log ERROR "Credentials file not found: $CREDENTIALS_FILE"
    log ERROR "Create file with: REMOTE_USER, REMOTE_HOST, REMOTE_PORT, REMOTE_PASSWORD, REMOTE_PATH"
    return 1
  fi
  
  # Source credentials
  source "$CREDENTIALS_FILE"
  
  # Validate required variables
  if [ -z "${REMOTE_USER:-}" ] || [ -z "${REMOTE_HOST:-}" ] || [ -z "${REMOTE_PASSWORD:-}" ] || [ -z "${REMOTE_PATH:-}" ]; then
    log ERROR "Missing required credentials in $CREDENTIALS_FILE"
    log ERROR "Required: REMOTE_USER, REMOTE_HOST, REMOTE_PASSWORD, REMOTE_PATH"
    return 1
  fi
  
  # Set default port if not specified
  REMOTE_PORT="${REMOTE_PORT:-22}"
  
  # Build SSH/SCP commands with sshpass
  SSH_CMD="sshpass -p '$REMOTE_PASSWORD' ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT"
  SCP_CMD="sshpass -p '$REMOTE_PASSWORD' scp -o StrictHostKeyChecking=no -P $REMOTE_PORT"
  
  # Test SSH connection
  log INFO "Testing SSH connection to ${REMOTE_USER}@${REMOTE_HOST}..."
  if ! eval "$SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'exit'" 2>/dev/null; then
    log ERROR "SSH connection test failed. Check credentials and network connectivity."
    return 1
  fi
  
  log INFO "Preflight checks passed"
  return 0
}

# ===== SETUP BACKUP DIRECTORY =====
setup_backup_dir() {
  log INFO "Setting up backup directory structure..."
  
  mkdir -p "${BACKUPS_DIR}/${BACKUP_DATE}"/{db,media,secrets,config,elasticsearch}
  
  log INFO "Backup directory: ${BACKUPS_DIR}/${BACKUP_DATE}"
}

# ===== BACKUP DATABASE =====
backup_database() {
  log INFO "Starting database backup..."
  
  cd "$REPO_ROOT"
  
  if docker compose exec -T db pg_dump -U hefaistos_user -d hefaistos_db \
    > "${BACKUPS_DIR}/${BACKUP_DATE}/db/hefaistos_db.sql" 2>/dev/null; then
    local db_size=$(du -h "${BACKUPS_DIR}/${BACKUP_DATE}/db/hefaistos_db.sql" | cut -f1)
    log INFO "Database backup completed successfully (${db_size})"
  else
    log ERROR "Database dump failed"
    return 1
  fi
}

# ===== BACKUP MEDIA =====
backup_media() {
  log INFO "Starting media files backup..."
  
  local media_path="${REPO_ROOT}/backend/media"
  
  if [ -d "$media_path" ]; then
    if cp -r "$media_path" "${BACKUPS_DIR}/${BACKUP_DATE}/media" 2>/dev/null; then
      local media_size=$(du -sh "${BACKUPS_DIR}/${BACKUP_DATE}/media" | cut -f1)
      log INFO "Media files backup completed (${media_size})"
    else
      log WARNING "Could not copy media directory"
    fi
  else
    log INFO "Media directory does not exist (no uploaded files yet)"
  fi
}

# ===== BACKUP SECRETS =====
backup_secrets() {
  log INFO "Starting secrets backup..."
  
  local secrets_path="${REPO_ROOT}/.secrets"
  
  if [ -d "$secrets_path" ]; then
    if cp -r "$secrets_path" "${BACKUPS_DIR}/${BACKUP_DATE}/secrets/.secrets" 2>/dev/null; then
      log INFO "Secrets directory backed up"
    else
      log ERROR "Could not copy secrets directory"
      return 1
    fi
  else
    log ERROR "Secrets directory not found at $secrets_path"
    return 1
  fi
  
  # Extract connector token from backend container
  cd "$REPO_ROOT"
  if docker compose exec -T backend cat /run/connector/token.jwt \
    > "${BACKUPS_DIR}/${BACKUP_DATE}/secrets/connector-token.jwt" 2>/dev/null; then
    log INFO "Connector token backed up"
  else
    log WARNING "Could not retrieve connector token from backend (may not be running)"
  fi
}

# ===== BACKUP CONFIG =====
backup_config() {
  log INFO "Starting configuration backup..."
  
  local config_files=(
    "backend/core/settings.py"
    "docker-compose.yml"
    ".env"
  )
  
  for file in "${config_files[@]}"; do
    if [ -f "${REPO_ROOT}/${file}" ]; then
      cp "${REPO_ROOT}/${file}" "${BACKUPS_DIR}/${BACKUP_DATE}/config/" 2>/dev/null || true
    fi
  done
  
  log INFO "Configuration files backed up"
}

# ===== BACKUP ELASTICSEARCH =====
backup_elasticsearch() {
  log INFO "Starting Elasticsearch snapshot backup..."
  
  cd "$REPO_ROOT"
  
  # Create Elasticsearch snapshot repository (one-time setup)
  log INFO "Ensuring Elasticsearch snapshot repository is registered..."
  if ! docker compose exec -T elasticsearch curl -X PUT "localhost:9200/_snapshot/hefaistos_repo" \
    -H 'Content-Type: application/json' \
    -d '{
      "type": "fs",
      "settings": {
        "location": "/usr/share/elasticsearch/snapshots"
      }
    }' 2>/dev/null; then
    log WARNING "Could not register snapshot repository; ensure elasticsearch.yml sets path.repo to /usr/share/elasticsearch/snapshots"
    return 0
  fi
  
  # Create a snapshot
  local snapshot_name="hefaistos_${BACKUP_DATE//"-"/"_"}"
  log INFO "Creating Elasticsearch snapshot: $snapshot_name..."
  
  if docker compose exec -T elasticsearch curl -X PUT "localhost:9200/_snapshot/hefaistos_repo/${snapshot_name}?wait_for_completion=true" \
    2>/dev/null; then
    log INFO "Elasticsearch snapshot created: $snapshot_name"
    log INFO "Elasticsearch snapshot stored in container volume (persistent)"
  else
    log WARNING "Elasticsearch snapshot creation failed or repository missing; check path.repo and permissions"
  fi
}

# ===== CREATE ARCHIVE =====
create_archive() {
  log INFO "Creating compressed archive..."
  
  local archive_file="${BACKUPS_DIR}/hefaistos-${BACKUP_DATE}.tar.gz"
  
  if tar -czf "$archive_file" -C "${BACKUPS_DIR}" "$BACKUP_DATE" 2>/dev/null; then
    local archive_size=$(du -h "$archive_file" | cut -f1)
    log INFO "Archive created successfully (${archive_size}): $archive_file"
  else
    log ERROR "Archive creation failed"
    return 1
  fi
  
  echo "$archive_file"
}

# ===== UPLOAD TO REMOTE SERVER =====
upload_to_remote() {
  local archive_file=$1
  log INFO "Uploading backup to remote server ${REMOTE_USER}@${REMOTE_HOST}..."
  
  local archive_name=$(basename "$archive_file")
  
  # Ensure remote directory exists
  log INFO "Ensuring remote directory exists: ${REMOTE_PATH}"
  eval "$SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'mkdir -p ${REMOTE_PATH}'" 2>/dev/null || {
    log WARNING "Could not create remote directory (may already exist)"
  }
  
  # Upload file with SCP
  log INFO "Uploading ${archive_name}..."
  if eval "$SCP_CMD '$archive_file' '${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${archive_name}'"; then
    log INFO "Upload completed successfully: ${REMOTE_PATH}/${archive_name}"
  else
    log ERROR "Upload failed"
    return 1
  fi
}

# ===== VERIFY UPLOAD =====
verify_upload() {
  log INFO "Verifying uploaded backup..."
  
  local archive_file="${BACKUPS_DIR}/hefaistos-${BACKUP_DATE}.tar.gz"
  local archive_name=$(basename "$archive_file")
  
  # Check if file exists on remote and compare sizes
  local remote_size=$(eval "$SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'stat -c%s ${REMOTE_PATH}/${archive_name} 2>/dev/null || stat -f%z ${REMOTE_PATH}/${archive_name} 2>/dev/null'" 2>/dev/null)
  local local_size=$(stat -c%s "$archive_file" 2>/dev/null || stat -f%z "$archive_file" 2>/dev/null)
  
  if [ -n "$remote_size" ] && [ "$local_size" = "$remote_size" ]; then
    log INFO "Backup verification passed (size: $local_size bytes)"
  else
    log WARNING "Could not verify remote file (local: $local_size, remote: $remote_size)"
  fi
}

# ===== CLEANUP LOCAL BACKUPS =====
cleanup_old_backups() {
  log INFO "Cleaning up local backups older than ${RETENTION_DAYS} days..."
  
  # Remove old backup directories
  find "${BACKUPS_DIR}" -maxdepth 1 -type d -name "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]" -mtime +${RETENTION_DAYS} \
    -exec rm -rf {} \; 2>/dev/null || true
  
  # Remove old archive files
  find "${BACKUPS_DIR}" -maxdepth 1 -type f -name "hefaistos-*.tar.gz" -mtime +${RETENTION_DAYS} \
    -exec rm {} \; 2>/dev/null || true
  
  log INFO "Local backup cleanup completed"
}

# ===== CLEANUP REMOTE BACKUPS =====
cleanup_remote_backups() {
  log INFO "Cleaning up remote backups older than ${RETENTION_DAYS} days..."
  
  # Use SSH to find and delete old backups
  local delete_cmd="find ${REMOTE_PATH} -name 'hefaistos-*.tar.gz' -type f -mtime +${RETENTION_DAYS} -delete"
  
  if eval "$SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} '$delete_cmd'" 2>&1 | tee -a >(logger -t "$LOG_TAG" -p user.info); then
    log INFO "Remote backup cleanup completed"
  else
    log WARNING "Remote cleanup encountered issues (may still be valid)"
  fi
  
  # Count remaining backups
  local backup_count=$(eval "$SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'ls -1 ${REMOTE_PATH}/hefaistos-*.tar.gz 2>/dev/null | wc -l'" 2>/dev/null || echo "0")
  log INFO "Remote backups remaining: ${backup_count}"
}

# ===== MAIN EXECUTION =====
main() {
  log INFO "=========================================="
  log INFO "Hefaistos Backup Job Started"
  log INFO "Date: $BACKUP_DATE Time: $BACKUP_TIME"
  log INFO "=========================================="
  
  preflight_checks || exit 1
  setup_backup_dir
  backup_database
  backup_media
  backup_secrets
  backup_config
  backup_elasticsearch
  
  local archive_file
  archive_file=$(create_archive)
  
  upload_to_remote "$archive_file"
  verify_upload
  
  cleanup_old_backups
  cleanup_remote_backups
  
  log INFO "=========================================="
  log INFO "Hefaistos Backup Job Completed Successfully"
  log INFO "=========================================="
}

# Run main function
main "$@"
