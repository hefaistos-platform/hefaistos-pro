#!/bin/bash

# =============================================================================
# HEFAISTOS AUTOMATED INSTALLATION SCRIPT
# =============================================================================
# Platform: Ubuntu 20.04+
# Purpose: Complete automated setup of Hefaistos with all dependencies
# 
# This script will:
#   1. Check system requirements
#   2. Install Docker and Docker Compose
#   3. Clone/setup Hefaistos repository
#   4. Create and manage secrets (.secrets/ directory)
#   5. Configure SSL certificates
#   6. Update configuration files with user inputs
#   7. Build and start Docker containers
#   8. Run health checks
#   9. Create superuser and import ATT&CK data
#   10. Generate detailed installation report
# =============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compose command (resolved at runtime)
COMPOSE_CMD=""

# Configuration
HEFAISTOS_DIR="${1:-/opt/hefaistos}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="${HEFAISTOS_DIR}/INSTALLATION_REPORT.txt"
LOG_FILE="${HEFAISTOS_DIR}/installation.log"
START_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# Global variables to track installation state
INSTALL_STATUS="RUNNING"
ERRORS_FOUND=0

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗ ERROR:${NC} $1" | tee -a "$LOG_FILE"
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} WARNING: $1" | tee -a "$LOG_FILE"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}" | tee -a "$LOG_FILE"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

set_compose_cmd() {
    # Prefer Docker Compose plugin (docker compose)
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
        return 0
    fi
    # Fallback to legacy docker-compose CLI
    if check_command docker-compose; then
        COMPOSE_CMD="docker-compose"
        return 0
    fi
    return 1
}

read_input() {
    local prompt="$1"
    local default="$2"
    local input
    
    if [ -z "$default" ]; then
        read -p "$(echo -e ${BLUE})$prompt:$(echo -e ${NC}) " input
    else
        read -p "$(echo -e ${BLUE})$prompt [${default}]:$(echo -e ${NC}) " input
        input="${input:-$default}"
    fi
    echo "$input"
}

read_password() {
    local prompt="$1"
    local password
    
    read -sp "$(echo -e ${BLUE})$prompt:$(echo -e ${NC}) " password
    echo ""
    echo "$password"
}

generate_password() {
    openssl rand -base64 32
}

generate_secret_key() {
    python3 -c "import secrets; print(secrets.token_urlsafe(50))"
}

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================

check_system_requirements() {
    print_section "Step 1: System Requirements Check"
    
    # Check OS
    if [[ ! "$OSTYPE" == "linux-gnu"* ]]; then
        log_error "This script requires Linux (Ubuntu 20.04+)"
        exit 1
    fi
    
    # Check Ubuntu version
    if ! check_command lsb_release; then
        log_error "lsb_release not found. Please install: sudo apt-get install lsb-release"
        exit 1
    fi
    
    UBUNTU_VERSION=$(lsb_release -rs)
    log "Detected Ubuntu version: $UBUNTU_VERSION"
    
    if (( $(echo "$UBUNTU_VERSION < 20.04" | bc -l) )); then
        log_error "Ubuntu 20.04 or higher required. Current: $UBUNTU_VERSION"
        exit 1
    fi
    log_success "Ubuntu version check passed"
    
    # Check internet connectivity
    log "Checking internet connectivity..."
    if ! ping -c 1 8.8.8.8 &> /dev/null; then
        log_warning "No internet connection detected. Some features may not work."
    else
        log_success "Internet connectivity confirmed"
    fi
    
    # Check disk space (minimum 10GB)
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if (( AVAILABLE_SPACE < 10 )); then
        log_error "Insufficient disk space. Minimum 10GB required, found ${AVAILABLE_SPACE}GB"
        exit 1
    fi
    log_success "Disk space check passed (${AVAILABLE_SPACE}GB available)"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
    log_success "Running as root"
}

# =============================================================================
# DEPENDENCY INSTALLATION
# =============================================================================

install_dependencies() {
    print_section "Step 2: Installing Dependencies"
    
    log "Updating package lists..."
    apt-get update -qq
    
    # Check for existing installations
    local to_install=""
    
    if ! check_command docker; then
        to_install="$to_install docker.io"
        log "Docker not found - will install"
    else
        log_success "Docker already installed"
    fi
    
    # Compose handled separately below (prefer plugin)
    
    if ! check_command git; then
        to_install="$to_install git"
        log "Git not found - will install"
    else
        log_success "Git already installed"
    fi
    
    if ! check_command openssl; then
        to_install="$to_install openssl"
        log "OpenSSL not found - will install"
    else
        log_success "OpenSSL already installed"
    fi
    
    if ! check_command python3; then
        to_install="$to_install python3"
        log "Python3 not found - will install"
    else
        log_success "Python3 already installed"
    fi
    
    if ! check_command curl; then
        to_install="$to_install curl"
        log "curl not found - will install"
    else
        log_success "curl already installed"
    fi
    
    if ! check_command bc; then
        to_install="$to_install bc"
    fi
    
    if [ -n "$to_install" ]; then
        log "Installing: $to_install"
        apt-get install -y -qq $to_install
        log_success "Dependencies installed"
    fi
    
    # Ensure Docker Compose plugin is available (Ubuntu 22.04+/24.04)
    if ! docker compose version >/dev/null 2>&1; then
        log "Installing Docker Compose plugin via apt..."
        apt-get install -y -qq docker-compose-plugin || true
    fi

    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose plugin available"
    elif check_command docker-compose; then
        log_warning "Using legacy docker-compose CLI"
    else
        log_error "Docker Compose not found after installation attempts"
        log "You can install with: apt-get install docker-compose-plugin"
        exit 1
    fi

    # Resolve compose command for subsequent steps
    if ! set_compose_cmd; then
        log_error "Failed to resolve Docker Compose command"
        exit 1
    fi
    
    log_success "All dependencies ready"
}

# =============================================================================
# REPOSITORY SETUP
# =============================================================================

setup_repository() {
    print_section "Step 3: Repository Setup"
    
    if [ -d "$HEFAISTOS_DIR" ] && [ -d "$HEFAISTOS_DIR/.git" ]; then
        log "Hefaistos directory already exists at $HEFAISTOS_DIR"
        read -p "Update existing repository? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log "Pulling latest changes..."
            cd "$HEFAISTOS_DIR"
            git pull origin main || log_warning "Could not pull latest changes"
        fi
    else
        log "Creating installation directory: $HEFAISTOS_DIR"
        mkdir -p "$HEFAISTOS_DIR"
        
        REPO_URL=$(read_input "Enter Hefaistos repository URL" "https://github.com/hefaistos-platform/hefaistos.git")
        
        log "Cloning repository from $REPO_URL..."
        if git clone "$REPO_URL" "$HEFAISTOS_DIR"; then
            log_success "Repository cloned successfully"
        else
            log_error "Failed to clone repository"
            exit 1
        fi
    fi
    
    cd "$HEFAISTOS_DIR"
    
    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    log_success "Repository ready at $HEFAISTOS_DIR"
}

# =============================================================================
# USER INPUT COLLECTION
# =============================================================================

collect_user_inputs() {
    print_section "Step 4: Configuration Inputs"
    
    echo "Please provide the following configuration details:"
    echo "(Press Enter to use default values where shown)"
    
    # Domain/IP input
    echo ""
    log "Server Configuration:"
    SERVER_DOMAIN=$(read_input "Enter domain or IP address for HTTPS access" "app.example.com")
    
    # Check if it's an IP address
    if [[ $SERVER_DOMAIN =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IS_IP_ADDRESS=1
        SSL_TYPE="self-signed"
    else
        IS_IP_ADDRESS=0
    fi
    
    # SSL Type selection
    echo ""
    echo "SSL Certificate Options:"
    echo "1) Self-signed (recommended for testing/internal)"
    echo "2) Let's Encrypt (recommended for production)"
    SSL_CHOICE=$(read_input "Choose SSL option" "1")
    
    if [ "$SSL_CHOICE" = "2" ]; then
        SSL_TYPE="letsencrypt"
        if [ $IS_IP_ADDRESS -eq 1 ]; then
            log_warning "Let's Encrypt requires a domain name, not IP address. Using self-signed instead."
            SSL_TYPE="self-signed"
        else
            SSL_EMAIL=$(read_input "Enter email for Let's Encrypt notifications" "admin@${SERVER_DOMAIN}")
        fi
    else
        SSL_TYPE="self-signed"
    fi
    
    # CORS Origins
    echo ""
    log "CORS Configuration (Frontend Origins):"
    echo "Separate multiple origins with commas"
    echo "Examples: http://localhost, https://app.example.com"
    DEFAULT_CORS="http://localhost,https://localhost,http://${SERVER_DOMAIN},https://${SERVER_DOMAIN}"
    CORS_ORIGINS=$(read_input "Enter CORS origins" "$DEFAULT_CORS")
    
    # Admin IP Restrictions
    echo ""
    log "Admin Panel IP Restrictions:"
    echo "Enter IP ranges allowed to access /admin/ (comma-separated)"
    echo "Examples: 192.168.1.0/24, 10.0.0.1, 127.0.0.1/32"
    DEFAULT_ADMIN_IPS="127.0.0.1/32,192.168.1.0/24,10.0.0.0/8"
    ADMIN_IP_RANGES=$(read_input "Enter admin IP ranges" "$DEFAULT_ADMIN_IPS")
    
    # Backend API Port
    echo ""
    BACKEND_PORT=$(read_input "Backend API port" "8000")
    
    # Database credentials
    echo ""
    log "Database Configuration:"
    DB_NAME=$(read_input "Database name" "hefaistos_db")
    DB_USER=$(read_input "Database user" "hefaistos_user")
    
    # Generate or ask for DB password
    GENERATED_DB_PASS=$(generate_password)
    log "Generated database password. You can keep it or enter your own."
    DB_PASSWORD=$(read_input "Database password (will be generated if empty)" "$GENERATED_DB_PASS")
    
    # RabbitMQ password
    echo ""
    log "RabbitMQ Configuration:"
    GENERATED_RMQ_PASS=$(generate_password)
    log "Generated RabbitMQ password. You can keep it or enter your own."
    RABBITMQ_PASSWORD=$(read_input "RabbitMQ password (will be generated if empty)" "$GENERATED_RMQ_PASS")
    
    # Superuser credentials
    echo ""
    log "Superuser Account:"
    ADMIN_EMAIL=$(read_input "Admin email" "admin@${SERVER_DOMAIN}")
    ADMIN_USERNAME=$(read_input "Admin username" "admin")
    ADMIN_PASSWORD=$(read_password "Admin password")
    
    # Firewall configuration
    echo ""
    log "Firewall Configuration (UFW):"
    read -p "Enable UFW firewall? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ENABLE_FIREWALL=1
    else
        ENABLE_FIREWALL=0
    fi
    
    # Backup configuration
    echo ""
    log "Backup Configuration:"
    read -p "Enable automatic backups? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ENABLE_BACKUPS=1
        BACKUP_SCHEDULE=$(read_input "Backup schedule (cron format)" "0 2 * * *")
        BACKUP_RETENTION=$(read_input "Backup retention (days)" "30")
    else
        ENABLE_BACKUPS=0
    fi
    
    # ATT&CK data import
    echo ""
    log "ATT&CK Data Import:"
    read -p "Import ATT&CK data after setup? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        IMPORT_ATTACK_DATA=1
    else
        IMPORT_ATTACK_DATA=0
    fi
    
    # Optional: MISP integration
    echo ""
    log "Optional Integrations (press Enter to skip):"
    MISP_ENABLED=$(read_input "Enable MISP integration? (y/n)" "n")
    if [[ $MISP_ENABLED =~ ^[Yy]$ ]]; then
        MISP_URL=$(read_input "MISP server URL" "https://misp.example.com")
        MISP_KEY=$(read_password "MISP API key")
    fi

    # Optional: Mailgun email notifications
    echo ""
    log "Email Notifications (Mailgun):"
    EMAIL_NOTIFICATIONS=$(read_input "Enable email notifications via Mailgun? (y/n)" "n")
    if [[ $EMAIL_NOTIFICATIONS =~ ^[Yy]$ ]]; then
        MAILGUN_DOMAIN=$(read_input "Mailgun domain" "mg.${SERVER_DOMAIN}")
        MAILGUN_FROM_EMAIL=$(read_input "From email" "no-reply@${SERVER_DOMAIN}")
        MAILGUN_REGION=$(read_input "Mailgun region (eu/us)" "eu")
        if [[ "$MAILGUN_REGION" =~ ^[Uu][Ss]$ ]]; then
            MAILGUN_API_BASE="https://api.mailgun.net"
        else
            MAILGUN_API_BASE="https://api.eu.mailgun.net"
        fi
        MAILGUN_API_KEY=$(read_password "Mailgun API key")
    else
        MAILGUN_REGION="eu"
        MAILGUN_API_BASE="https://api.eu.mailgun.net"
    fi
    
    log_success "Configuration inputs collected"
}

# =============================================================================
# SECRETS MANAGEMENT
# =============================================================================

setup_secrets() {
    print_section "Step 5: Secrets Generation and Setup"
    
    SECRETS_DIR="${HEFAISTOS_DIR}/.secrets"
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
    log "Created secrets directory: $SECRETS_DIR"
    
    # Field encryption key (CRITICAL)
    if [ ! -s "$SECRETS_DIR/field_key" ]; then
        log "Generating field encryption key..."
        python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > "$SECRETS_DIR/field_key"
        chmod 600 "$SECRETS_DIR/field_key"
        log_success "Field encryption key generated"
    else
        log_warning "Field encryption key already exists - keeping existing"
    fi
    
    # Database password
    if [ ! -f "$SECRETS_DIR/db_password" ]; then
        echo -n "$DB_PASSWORD" > "$SECRETS_DIR/db_password"
        chmod 600 "$SECRETS_DIR/db_password"
        log_success "Database password saved"
    else
        log_warning "Database password already exists"
    fi
    
    # RabbitMQ password
    if [ ! -f "$SECRETS_DIR/rabbitmq_pass" ]; then
        echo -n "$RABBITMQ_PASSWORD" > "$SECRETS_DIR/rabbitmq_pass"
        chmod 600 "$SECRETS_DIR/rabbitmq_pass"
        log_success "RabbitMQ password saved"
    else
        log_warning "RabbitMQ password already exists"
    fi

    # Mailgun API key (optional)
    if [[ $EMAIL_NOTIFICATIONS =~ ^[Yy]$ ]] && [ -n "$MAILGUN_API_KEY" ]; then
        echo -n "$MAILGUN_API_KEY" > "$SECRETS_DIR/mailgun_api"
        chmod 600 "$SECRETS_DIR/mailgun_api"
        log_success "Mailgun API key saved to secrets"
    fi
    
    # JWT Secret (if not already generated)
    if [ ! -f "$SECRETS_DIR/jwt_secret" ]; then
        JWT_SECRET=$(generate_secret_key)
        echo -n "$JWT_SECRET" > "$SECRETS_DIR/jwt_secret"
        chmod 600 "$SECRETS_DIR/jwt_secret"
        log_success "JWT secret generated"
    fi
    
    # MISP key (optional)
    if [ ! -z "$MISP_KEY" ]; then
        echo -n "$MISP_KEY" > "$SECRETS_DIR/misp_key"
        chmod 600 "$SECRETS_DIR/misp_key"
        log_success "MISP API key saved"
    fi
    
    # Verify all secrets
    log "Verifying secrets..."
    for secret in field_key db_password rabbitmq_pass jwt_secret; do
        if [ -s "$SECRETS_DIR/$secret" ]; then
            log_success "✓ $secret"
        else
            log_error "Missing or empty: $secret"
        fi
    done
    
    log_success "Secrets directory ready"
}

# =============================================================================
# SSL CERTIFICATE GENERATION
# =============================================================================

setup_ssl_certificates() {
    print_section "Step 6: SSL Certificate Setup"
    
    CERT_DIR="${HEFAISTOS_DIR}/nginx/certs"
    mkdir -p "$CERT_DIR"
    
    if [ "$SSL_TYPE" = "self-signed" ]; then
        log "Generating self-signed certificate for $SERVER_DOMAIN..."
        
        if [ -f "$CERT_DIR/server.crt" ]; then
            log_warning "Certificate already exists - skipping generation"
        else
            openssl req -x509 -newkey rsa:4096 -keyout "$CERT_DIR/server.key" \
                -out "$CERT_DIR/server.crt" -days 365 -nodes \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=$SERVER_DOMAIN" 2>/dev/null
            
            chmod 644 "$CERT_DIR/server.crt"
            chmod 600 "$CERT_DIR/server.key"
            
            log_success "Self-signed certificate generated"
            log "  Certificate: $CERT_DIR/server.crt"
            log "  Key: $CERT_DIR/server.key"
            log "  Valid for 365 days"
        fi
    
    elif [ "$SSL_TYPE" = "letsencrypt" ]; then
        log "Setting up Let's Encrypt certificate for $SERVER_DOMAIN..."
        
        if ! check_command certbot; then
            log "Installing certbot..."
            apt-get install -y -qq certbot python3-certbot-nginx
        fi
        
        log "Requesting certificate from Let's Encrypt..."
        certbot certonly --standalone -d "$SERVER_DOMAIN" --non-interactive \
            --agree-tos -m "$SSL_EMAIL" 2>&1 | tee -a "$LOG_FILE"
        
        CERT_PATH="/etc/letsencrypt/live/${SERVER_DOMAIN}/fullchain.pem"
        KEY_PATH="/etc/letsencrypt/live/${SERVER_DOMAIN}/privkey.pem"
        
        if [ -f "$CERT_PATH" ]; then
            log_success "Let's Encrypt certificate obtained"
            log "  Certificate: $CERT_PATH"
            log "  Key: $KEY_PATH"
        else
            log_error "Failed to obtain Let's Encrypt certificate"
            log_warning "Falling back to self-signed certificate"
            SSL_TYPE="self-signed"
            setup_ssl_certificates  # Recursive call to generate self-signed
        fi
    fi
}

# =============================================================================
# CONFIGURATION FILES UPDATE
# =============================================================================

update_configuration_files() {
    print_section "Step 7: Updating Configuration Files"
    
    # Create .env file from template
    if [ -f "${HEFAISTOS_DIR}/.env.template" ]; then
        log "Creating .env from template..."
        cp "${HEFAISTOS_DIR}/.env.template" "${HEFAISTOS_DIR}/.env"
        
        # Update .env with user values
        sed -i "s|SERVER_DOMAIN=.*|SERVER_DOMAIN=${SERVER_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|ALLOWED_HOSTS=.*|ALLOWED_HOSTS=${SERVER_DOMAIN},localhost,127.0.0.1|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=${CORS_ORIGINS}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|CSRF_TRUSTED_ORIGINS=.*|CSRF_TRUSTED_ORIGINS=https://${SERVER_DOMAIN},http://${SERVER_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://${SERVER_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://${SERVER_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=https://${SERVER_DOMAIN}/graphql|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|WEBAUTHN_RP_ID=.*|WEBAUTHN_RP_ID=${SERVER_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|WEBAUTHN_ORIGIN=.*|WEBAUTHN_ORIGIN=https://${SERVER_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|ADMIN_ALLOWED_IP_RANGES=.*|ADMIN_ALLOWED_IP_RANGES=${ADMIN_IP_RANGES}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|DB_NAME=.*|DB_NAME=${DB_NAME}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|DB_USER=.*|DB_USER=${DB_USER}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|DEBUG=.*|DEBUG=False|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|SECRET_KEY=.*|SECRET_KEY=$(generate_secret_key)|g" "${HEFAISTOS_DIR}/.env"

        if [[ $EMAIL_NOTIFICATIONS =~ ^[Yy]$ ]]; then
            sed -i "s|EMAIL_ENABLED=.*|EMAIL_ENABLED=True|g" "${HEFAISTOS_DIR}/.env"
            sed -i "s|EMAIL_HOST_USER=.*|EMAIL_HOST_USER=postmaster@${MAILGUN_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        else
            sed -i "s|EMAIL_ENABLED=.*|EMAIL_ENABLED=False|g" "${HEFAISTOS_DIR}/.env"
        fi
        
        log_success ".env file created"
    fi
    
    # Create docker-compose.override.yml if not exists
    if [ ! -f "${HEFAISTOS_DIR}/docker-compose.override.yml" ] && [ -f "${HEFAISTOS_DIR}/docker-compose.override.yml.template" ]; then
        log "Creating docker-compose.override.yml..."
        cp "${HEFAISTOS_DIR}/docker-compose.override.yml.template" "${HEFAISTOS_DIR}/docker-compose.override.yml"
        log_success "docker-compose.override.yml created"
    fi
    
    # Update nginx configuration with domain
    log "Updating nginx configuration..."
    NGINX_CONF="${HEFAISTOS_DIR}/nginx/nginx.conf"
    if [ -f "$NGINX_CONF" ]; then
        # This is simplified - actual implementation may need more careful sed patterns
        sed -i "s/server_name.*/server_name ${SERVER_DOMAIN};/g" "$NGINX_CONF"
        log_success "nginx configuration updated"
    fi

    # Mailgun settings written to .env (picked up by docker-compose variable substitution)
    if [[ $EMAIL_NOTIFICATIONS =~ ^[Yy]$ ]]; then
        sed -i "s|MAILGUN_DOMAIN=.*|MAILGUN_DOMAIN=${MAILGUN_DOMAIN}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|MAILGUN_FROM_EMAIL=.*|MAILGUN_FROM_EMAIL=${MAILGUN_FROM_EMAIL}|g" "${HEFAISTOS_DIR}/.env"
        sed -i "s|MAILGUN_API_BASE=.*|MAILGUN_API_BASE=${MAILGUN_API_BASE}|g" "${HEFAISTOS_DIR}/.env"
    fi
    
    log_success "Configuration files updated"
}

# =============================================================================
# DOCKER BUILD AND START
# =============================================================================

build_and_start_docker() {
    print_section "Step 8: Building and Starting Docker Containers"
    
    cd "$HEFAISTOS_DIR"
    
    log "Pulling latest base images..."
    docker pull ubuntu:20.04 2>&1 | tail -n 1
    docker pull python:3.11-slim 2>&1 | tail -n 1
    docker pull postgres:15 2>&1 | tail -n 1
    docker pull rabbitmq:3.12-management 2>&1 | tail -n 1
    docker pull nginx:latest 2>&1 | tail -n 1
    log_success "Base images ready"
    
    log "Building Hefaistos containers..."
    if $COMPOSE_CMD build 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Containers built successfully"
    else
        log_error "Failed to build containers"
        return 1
    fi
    
    log "Starting containers (this may take a minute)..."
    if $COMPOSE_CMD up -d 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Containers started"
    else
        log_error "Failed to start containers"
        return 1
    fi
    
    # Wait for database to be reachable from backend before proceeding.
    # This avoids migrate failures caused by transient Docker DNS startup timing.
    log "Waiting for database DNS and readiness..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if $COMPOSE_CMD exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null && \
           $COMPOSE_CMD exec -T backend python -c "import os,socket; socket.gethostbyname(os.getenv('DB_HOST', 'db'))" &> /dev/null; then
            sleep 2
            log_success "Database is resolvable from backend and accepting connections"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -ne "\rWaiting for DB readiness... ($attempt/$max_attempts)"
        sleep 2
    done
    
    log_warning "Database did not become ready within timeout"
    return 1
}

wait_for_db_from_backend() {
    # Ensure backend container can resolve DB host and DB is accepting connections
    # before running migration-related management commands.
    local max_attempts=30
    local attempt=0

    log "Verifying DB hostname resolution from backend..."
    while [ $attempt -lt $max_attempts ]; do
        if $COMPOSE_CMD exec -T backend python -c "import os,socket; socket.gethostbyname(os.getenv('DB_HOST', 'db'))" &> /dev/null && \
           $COMPOSE_CMD exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
            log_success "Backend can resolve DB host and PostgreSQL is ready"
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    log_error "DB host is not resolvable from backend or PostgreSQL is not ready"
    log "Diagnostics:"
    $COMPOSE_CMD ps | tee -a "$LOG_FILE"
    $COMPOSE_CMD logs --tail=50 db | tee -a "$LOG_FILE" || true
    $COMPOSE_CMD logs --tail=50 backend | tee -a "$LOG_FILE" || true
    return 1
}

# =============================================================================
# HEALTH CHECKS
# =============================================================================

perform_health_checks() {
    print_section "Step 9: Health Checks and Verification"
    
    cd "$HEFAISTOS_DIR"
    
    # Check container status
    log "Checking container status..."
    HEALTH_STATUS="OK"
    
    $COMPOSE_CMD ps | tee -a "$LOG_FILE"
    
    # Check backend
    log "Checking backend API via NGINX proxy..."
    if curl -sk https://localhost/graphql -H 'Content-Type: application/json' -d '{"query":"{__typename}"}' >/dev/null; then
        log_success "Backend API responding on https://localhost/graphql"
    elif curl -s http://localhost/graphql -H 'Content-Type: application/json' -d '{"query":"{__typename}"}' >/dev/null; then
        log_success "Backend API responding on http://localhost/graphql"
    else
        log_warning "Backend API not responding yet"
        HEALTH_STATUS="DEGRADED"
    fi
    
    # Check database connection
    log "Checking database connection..."
    if $COMPOSE_CMD exec -T db pg_isready -U "$DB_USER" &> /dev/null; then
        log_success "Database connected"
    else
        log_warning "Database connection check failed"
        HEALTH_STATUS="DEGRADED"
    fi
    
    # Check RabbitMQ
    log "Checking RabbitMQ..."
    if $COMPOSE_CMD exec -T rabbitmq rabbitmq-diagnostics -q ping &> /dev/null; then
        log_success "RabbitMQ responding"
    else
        log_warning "RabbitMQ check failed"
        HEALTH_STATUS="DEGRADED"
    fi
    
    # Check frontend
    log "Checking frontend..."
    if curl -s http://localhost:3000 | grep -q "<!DOCTYPE"; then
        log_success "Frontend accessible"
    else
        log_warning "Frontend not yet accessible"
        HEALTH_STATUS="DEGRADED"
    fi
    
    echo "HEALTH_STATUS=$HEALTH_STATUS" >> "$LOG_FILE"
    
    if [ "$HEALTH_STATUS" = "OK" ]; then
        log_success "All health checks passed"
    else
        log_warning "Some services may still be initializing"
    fi
}

# =============================================================================
# SUPERUSER CREATION
# =============================================================================

create_superuser() {
    print_section "Step 10: Creating Superuser Account"
    
    cd "$HEFAISTOS_DIR"
    
    log "Creating superuser: $ADMIN_USERNAME"

    if ! wait_for_db_from_backend; then
        return 1
    fi
    
    # Run migrations first
    log "Running database migrations..."
    if $COMPOSE_CMD exec -T backend python manage.py migrate 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Migrations completed"
    else
        log_error "Migrations failed"
        return 1
    fi
    
    # Create superuser
     if echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='$ADMIN_USERNAME').delete(); User.objects.create_superuser('$ADMIN_USERNAME', '$ADMIN_EMAIL', '$ADMIN_PASSWORD')" | \
         $COMPOSE_CMD exec -T backend python manage.py shell 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Superuser created: $ADMIN_USERNAME"
    else
        log_error "Failed to create superuser"
        return 1
    fi
}

# =============================================================================
# ATT&CK DATA IMPORT (OPTIONAL)
# =============================================================================

import_attack_data() {
    if [ $IMPORT_ATTACK_DATA -ne 1 ]; then
        log "Skipping ATT&CK data import (user declined)"
        return 0
    fi
    
    print_section "Step 11: Importing ATT&CK Data"
    
    cd "$HEFAISTOS_DIR"
    
    log "This may take several minutes..."
    
    if $COMPOSE_CMD exec -T backend python manage.py import_mitre_universal \
       --mitre-version 19.0 --mode remote 2>&1 | tee -a "$LOG_FILE"; then
        log_success "ATT&CK data imported successfully"
    else
        log_error "Failed to import ATT&CK data"
        log_warning "You can retry later with: $COMPOSE_CMD exec backend python manage.py import_mitre_universal"
    fi
}

# =============================================================================
# FIREWALL SETUP (OPTIONAL)
# =============================================================================

setup_firewall() {
    if [ $ENABLE_FIREWALL -ne 1 ]; then
        log "Firewall setup skipped (user declined)"
        return 0
    fi
    
    print_section "Step 12: Firewall Configuration (UFW)"
    
    log "Enabling UFW firewall..."
    
    if ! check_command ufw; then
        log "Installing ufw..."
        apt-get install -y -qq ufw
    fi
    
    # Set default policies
    ufw --force enable &> /dev/null
    ufw default deny incoming &> /dev/null
    ufw default allow outgoing &> /dev/null
    
    # Allow SSH (important!)
    ufw allow 22/tcp comment "SSH" &> /dev/null
    log_success "SSH access allowed (port 22)"
    
    # Allow NGINX public ports
    ufw allow 80/tcp comment "HTTP (NGINX)" &> /dev/null
    ufw allow 443/tcp comment "HTTPS (NGINX)" &> /dev/null
    log_success "Web access allowed (ports 80, 443)"
    
    # Allow backend if not behind proxy
    if [ "$BACKEND_PORT" != "8000" ]; then
        ufw allow $BACKEND_PORT/tcp comment "Backend API" &> /dev/null
        log_success "Backend API allowed (port $BACKEND_PORT)"
    fi
    
    # Show status
    log "Firewall rules:"
    ufw status numbered | tee -a "$LOG_FILE"
    
    log_success "Firewall configured"
}

# =============================================================================
# BACKUP SETUP (OPTIONAL)
# =============================================================================

setup_backups() {
    if [ $ENABLE_BACKUPS -ne 1 ]; then
        log "Backup setup skipped (user declined)"
        return 0
    fi
    
    print_section "Step 13: Backup Configuration"
    
    BACKUP_DIR="${HEFAISTOS_DIR}/backups"
    mkdir -p "$BACKUP_DIR"
    
    # Create backup script
    BACKUP_SCRIPT="${HEFAISTOS_DIR}/scripts/backup-hefaistos.sh"
    mkdir -p "$(dirname "$BACKUP_SCRIPT")"
    
    cat > "$BACKUP_SCRIPT" << 'BACKUP_EOF'
#!/bin/bash
# Hefaistos Backup Script
# This script backs up the database and configuration

BACKUP_DIR="$1"
HEFAISTOS_DIR="$(dirname "$0")/.."
RETENTION_DAYS="${2:-30}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/hefaistos_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

cd "$HEFAISTOS_DIR"

echo "Starting backup at $(date)"
echo "Backing up to: $BACKUP_FILE"

# Backup database
docker compose exec -T db pg_dump -U hefaistos_user hefaistos_db | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Database backup completed: $BACKUP_FILE"
    ls -lh "$BACKUP_FILE"
else
    echo "✗ Backup failed"
    exit 1
fi

# Cleanup old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "hefaistos_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed at $(date)"
BACKUP_EOF
    
    chmod +x "$BACKUP_SCRIPT"
    log_success "Backup script created: $BACKUP_SCRIPT"
    
    # Setup cron job
    log "Setting up cron job for automated backups..."
    
    CRON_JOB="$BACKUP_SCHEDULE $BACKUP_SCRIPT $BACKUP_DIR $BACKUP_RETENTION"
    
    # Check if cron already exists
    if crontab -l 2>/dev/null | grep -q "backup-hefaistos.sh"; then
        log_warning "Cron job already exists - not adding duplicate"
    else
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        log_success "Cron job created: $BACKUP_SCHEDULE"
    fi
    
    # Run initial backup
    log "Running initial backup..."
    if bash "$BACKUP_SCRIPT" "$BACKUP_DIR" "$BACKUP_RETENTION"; then
        log_success "Initial backup completed"
    else
        log_error "Initial backup failed"
    fi
}

# =============================================================================
# INSTALLATION REPORT GENERATION
# =============================================================================

generate_report() {
    print_section "Step 14: Generating Installation Report"
    
    END_TIME=$(date "+%Y-%m-%d %H:%M:%S")
    
    cat > "$REPORT_FILE" << EOF
================================================================================
                    HEFAISTOS INSTALLATION REPORT
================================================================================

Installation Date: $START_TIME
Completion Date:   $END_TIME
Installation Path: $HEFAISTOS_DIR

================================================================================
INSTALLATION SUMMARY
================================================================================

Installation Status: $([ $ERRORS_FOUND -eq 0 ] && echo "SUCCESS ✓" || echo "COMPLETED WITH WARNINGS ⚠")
Total Errors: $ERRORS_FOUND
Log File: $LOG_FILE

================================================================================
CONFIGURATION DETAILS
================================================================================

Server Configuration:
  Domain/IP:            $SERVER_DOMAIN
  Backend Port:         $BACKEND_PORT
  SSL Type:             $SSL_TYPE
  Certificate Location: $([ "$SSL_TYPE" = "self-signed" ] && echo "${HEFAISTOS_DIR}/nginx/certs/" || echo "/etc/letsencrypt/live/${SERVER_DOMAIN}/")

Database Configuration:
  Engine:        PostgreSQL 15
  Database Name: $DB_NAME
  Database User: $DB_USER
  Host:          db (Docker)
  Port:          5432
  Password:      Stored in .secrets/db_password

RabbitMQ Configuration:
  Host:       rabbitmq (Docker)
  Port:       5672
  User:       guest
  Password:   Stored in .secrets/rabbitmq_pass

API & CORS Configuration:
    Backend GraphQL:     https://localhost/graphql
  CORS Origins:        $CORS_ORIGINS
  Admin IP Whitelist:  $ADMIN_IP_RANGES

Superuser Account:
  Username: $ADMIN_USERNAME
  Email:    $ADMIN_EMAIL

================================================================================
DOCKER CONTAINERS
================================================================================

Services Running:
EOF
    
    $COMPOSE_CMD ps >> "$REPORT_FILE" 2>&1
    
    cat >> "$REPORT_FILE" << EOF

Container Images:
EOF
    
    docker images | grep hefaistos >> "$REPORT_FILE" 2>&1
    
    cat >> "$REPORT_FILE" << EOF

================================================================================
NEXT STEPS & ACCESS INFORMATION
================================================================================

1. ACCESS THE PLATFORM:
   - Frontend: https://${SERVER_DOMAIN}
   - Admin Panel: https://${SERVER_DOMAIN}/admin
   - GraphQL API: https://${SERVER_DOMAIN}/graphql
   
   Login with:
   - Username: $ADMIN_USERNAME
   - Email: $ADMIN_EMAIL

2. VERIFY INSTALLATION:
    - Check all containers: cd $HEFAISTOS_DIR && $COMPOSE_CMD ps
    - View backend logs: $COMPOSE_CMD logs backend
    - View frontend logs: $COMPOSE_CMD logs frontend
    - Test API: curl -sk https://${SERVER_DOMAIN}/graphql -H 'Content-Type: application/json' -d '{"query":"{__typename}"}' | head -c 100

3. IMPORT ATT&CK DATA (if not already done):
   $COMPOSE_CMD exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote

4. CONFIGURE OPTIONAL FEATURES:
   - MISP Integration: Update .env with MISP_URL and store API key in .secrets/misp_key
   - L1 Portal share links: set PUBLIC_BASE_URL in .env when using extra proxy layers
   - Email Notifications: Configure SMTP settings in .env
   - Backup Schedule: Edit cron with: crontab -e

5. SECURITY RECOMMENDATIONS:
   - Change admin password immediately upon first login
   - Update SECRET_KEY in .env (currently auto-generated)
   - Configure real SSL certificates for production
   - Set up proper firewall rules (UFW configured: $ENABLE_FIREWALL)
   - Enable automated backups (configured: $ENABLE_BACKUPS)
   - Restrict admin panel access to specific IPs

6. MAINTENANCE:
   - Backup: $HEFAISTOS_DIR/scripts/backup-hefaistos.sh $HEFAISTOS_DIR/backups
    - Update images: cd $HEFAISTOS_DIR && $COMPOSE_CMD pull && $COMPOSE_CMD up -d
    - View logs: $COMPOSE_CMD logs -f [service_name]

================================================================================
IMPORTANT FILES & LOCATIONS
================================================================================

Configuration:
  .env                                 Environment variables
  .secrets/                            Secrets directory (DO NOT COMMIT!)
  docker-compose.yml                   Main docker-compose configuration
  docker-compose.override.yml          Optional host-port and local overrides
  nginx/nginx.conf                     Nginx reverse proxy configuration

Documentation:
  README.md                            Project README
  INSTALLATION_GUIDE.md                Detailed installation guide
  Docs/                                Additional documentation

Logs & Backups:
  installation.log                     This installation log
  INSTALLATION_REPORT.txt              This report
  backups/                             Database backups directory

Keys & Certificates:
  .secrets/field_key                   Fernet encryption key (BACKUP THIS!)
  .secrets/db_password                 Database password
  .secrets/rabbitmq_pass               RabbitMQ password
  nginx/certs/                         SSL certificates

================================================================================
COMMON COMMANDS
================================================================================

View all logs:
    $COMPOSE_CMD logs -f

Restart all services:
    $COMPOSE_CMD restart

Stop all services:
    $COMPOSE_CMD stop

Start all services:
    $COMPOSE_CMD start

View specific service logs:
    $COMPOSE_CMD logs -f [backend|frontend|db|rabbitmq|nginx]

Access database shell:
    $COMPOSE_CMD exec db psql -U $DB_USER -d $DB_NAME

Create superuser:
    $COMPOSE_CMD exec backend python manage.py createsuperuser

Execute management command:
    $COMPOSE_CMD exec backend python manage.py [command]

================================================================================
TROUBLESHOOTING
================================================================================

Backend not responding:
    $COMPOSE_CMD logs backend

Frontend not loading:
    $COMPOSE_CMD logs frontend
  Check CORS_ALLOWED_ORIGINS in .env

Database connection failed:
    $COMPOSE_CMD logs db
  Check DB_NAME, DB_USER in .env

RabbitMQ issues:
    $COMPOSE_CMD logs rabbitmq
  Check .secrets/rabbitmq_pass

SSL certificate errors:
  - For self-signed: Browser will show warning (normal)
  - For Let's Encrypt: Ensure domain DNS resolves correctly

Port conflicts:
  If ports 80 or 443 are in use:
  Create/edit docker-compose.override.yml and remap host ports (keep container ports 8080/8443), example:
    nginx:
      ports:
        - "8080:8080"
        - "4443:8443"

Out of disk space:
  docker system prune -a
  rm -rf backups/old_*

================================================================================
ROLLBACK PROCEDURE
================================================================================

If installation failed or you need to rollback:

1. Stop all containers:
    $COMPOSE_CMD down

2. Restore from backup:
   $COMPOSE_CMD exec db psql -U $DB_USER -d $DB_NAME < backups/hefaistos_backup_YYYYMMDD_HHMMSS.sql

3. Or completely remove and reinstall:
   cd $HEFAISTOS_DIR
   ./scripts/uninstall-hefaistos.sh

================================================================================
SUPPORT & DOCUMENTATION
================================================================================

GitHub Repository: https://github.com/hefaistos-platform/hefaistos
Documentation: $HEFAISTOS_DIR/README.md
Issues: https://github.com/hefaistos-platform/hefaistos/issues

For detailed setup guides, see: $HEFAISTOS_DIR/Docs/

================================================================================
END OF REPORT
================================================================================

Generated at: $(date)
EOF
    
    log_success "Installation report generated: $REPORT_FILE"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    clear
    
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║        HEFAISTOS AUTOMATED INSTALLATION SCRIPT                 ║"
    echo "║        Platform: Ubuntu 20.04+                                 ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Execute installation steps
    check_system_requirements
    install_dependencies
    setup_repository
    collect_user_inputs
    setup_secrets
    setup_ssl_certificates
    update_configuration_files
    build_and_start_docker
    perform_health_checks
    create_superuser
    import_attack_data
    setup_firewall
    setup_backups
    generate_report
    
    # Final summary
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    if [ $ERRORS_FOUND -eq 0 ]; then
        echo -e "║  ${GREEN}✓ INSTALLATION COMPLETED SUCCESSFULLY${NC}                   ║"
    else
        echo -e "║  ${YELLOW}⚠ INSTALLATION COMPLETED WITH $ERRORS_FOUND ERROR(S)${NC}                 ║"
    fi
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📄 Report: $REPORT_FILE"
    echo "📋 Log:    $LOG_FILE"
    echo ""
    echo "🌐 Access your platform at: https://${SERVER_DOMAIN}"
    echo "👤 Admin user: $ADMIN_USERNAME"
    echo ""
    echo "For detailed next steps, see: $REPORT_FILE"
}

# Run main function
main "$@"
