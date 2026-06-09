# HEFAISTOS CLEAN INSTALLATION GUIDE

Complete automated installation guide for Hefaistos on Ubuntu 20.04+

## Table of Contents

1. [Quick Start](#quick-start)
2. [Requirements](#requirements)
3. [Installation Steps](#installation-steps)
4. [Post-Installation](#post-installation)
5. [Troubleshooting](#troubleshooting)
6. [Uninstallation](#uninstallation)
7. [Maintenance](#maintenance)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos

# 2. Make installation script executable
chmod +x install-hefaistos.sh

# 3. Run installation as root
sudo ./install-hefaistos.sh

# Follow the interactive prompts to configure your installation
```

**Estimated Installation Time:** 15-30 minutes (depending on internet speed and system performance)

---

## Requirements

### System Requirements

- **OS:** Ubuntu 20.04 LTS or newer
- **CPU:** 2+ cores (4+ recommended for production)
- **RAM:** 4GB minimum (8GB+ recommended)
- **Disk Space:** 10GB+ available (20GB+ recommended)
- **Network:** Internet connection required for initial setup and ATT&CK data download

### Software Requirements

The installation script will automatically install:

- Docker (latest stable)
- Docker Compose plugin (docker compose)
- Git
- OpenSSL
- Python 3
- curl
- UFW (optional firewall)

**Ubuntu 24.04+ (PEP 668) Note:**

- System Python is externally managed; avoid `pip install docker-compose`.
- Preferred: `sudo apt-get install docker-compose-plugin` (the installer does this).
- The script auto-detects `docker compose` (plugin) and falls back to legacy `docker-compose` only if already present.

### Internet Connectivity

The installation process requires:

- **GitHub:** Clone Hefaistos repository
- **Docker Hub:** Pull base images (Ubuntu, Python, PostgreSQL, RabbitMQ, Nginx)
- **MITRE ATT&CK:** Download latest threat data (optional, can be done post-installation)

---

## Installation Steps

### Step 1: Prepare Your System

```bash
# Update package manager
sudo apt-get update && sudo apt-get upgrade -y

# Clone the repository
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos

# Make scripts executable
chmod +x install-hefaistos.sh
chmod +x scripts/*.sh
```

### Step 2: Run the Installation Script

```bash
# Run as root (required for Docker and firewall configuration)
sudo ./install-hefaistos.sh

# Or specify a custom installation directory
sudo ./install-hefaistos.sh /opt/hefaistos

# If Docker Compose plugin is missing on Ubuntu 24.04+
sudo apt-get install -y docker-compose-plugin
```

### Step 3: Answer Configuration Prompts

The installation script will ask you for:

#### **Server Configuration**

```
Server Domain/IP: app.example.com
  - Used for: SSL certificates, HTTPS access, API endpoints
  - Examples: app.example.com, 192.168.1.100, hefaistos.local

SSL Certificate Type:
  1) Self-signed (for testing/internal use)
  2) Let's Encrypt (for production with domain name)
```

#### **CORS Configuration (Frontend Origins)**

```
CORS Origins: https://app.example.com:8443, https://app.example.com
  - Comma-separated list of additional origins that can access the API
  - Since the frontend and backend share the same Nginx origin, this is
    mainly needed for external tools (e.g. the ATT&CK Navigator)
  - mitre-attack.github.io is always included automatically
  - Default includes your domain (derived from the Server Domain above)

Note: Media files (avatars, images) are served with open CORS by default
so avatars load correctly from any browser without extra configuration.
To restrict media access, edit nginx/conf.d/hefaistos.conf after installation.
```

#### **Admin IP Restrictions**

```
Admin IP Ranges: 127.0.0.1/32, 192.168.1.0/24, 10.0.0.0/8
  - IP addresses/networks allowed to access /admin/ panel
  - CIDR notation: 192.168.1.0/24 (all IPs from .1 to .254)
  - Single IPs: 192.168.1.100/32 or just 192.168.1.100
```

#### **Database Credentials**

```
Database Name: hefaistos_db (default)
Database User: hefaistos_user (default)
Database Password: [auto-generated or enter custom]
```

#### **Superuser Account**

```
Admin Email: admin@example.com
Admin Username: admin
Admin Password: [hidden input]
```

#### **Optional Features**

```
Enable UFW Firewall? (y/n) - Recommended
Enable Automated Backups? (y/n) - Recommended
Import ATT&CK Data? (y/n) - Recommended
Enable MISP Integration? (y/n) - Optional
```

### Step 4: Wait for Installation to Complete

The script will:

1. ✅ Check system requirements
2. ✅ Install Docker and dependencies
3. ✅ Clone/update repository
4. ✅ Generate and store secrets in `.secrets/` directory
5. ✅ Create SSL certificates
6. ✅ Update configuration files
7. ✅ Build Docker containers
8. ✅ Start containers
9. ✅ Run database migrations
10. ✅ Create superuser account
11. ✅ (Optional) Import ATT&CK data
12. ✅ (Optional) Configure firewall
13. ✅ (Optional) Setup backup automation
14. ✅ Generate installation report

### Step 5: Review Installation Report

```
HEFAISTOS INSTALLATION REPORT
Location: /opt/hefaistos/INSTALLATION_REPORT.txt

Check:
- All services are running (docker-compose ps)
- SSL certificates are valid
- Database migrations completed
- Superuser account created
```

---

## Post-Installation

### Access Your Hefaistos Platform

**Frontend (Web UI)**
```
URL: https://app.example.com
Username: admin
Password: [your superuser password]
```

**Admin Panel**
```
URL: https://app.example.com/admin
Login: Same as above
```

**GraphQL API**
```
URL: https://app.example.com/graphql
Authentication: JWT token or session cookie
```

### Verify Installation

```bash
# Check all containers are running
docker-compose ps

# Should show: db, backend, frontend, nginx, rabbitmq (RUNNING)

# Check backend logs
docker-compose logs backend

# Check if GraphQL endpoint is responding
curl -s https://app.example.com/graphql | head -c 100

# Access PostgreSQL directly (for debugging)
docker-compose exec db psql -U hefaistos_user -d hefaistos_db
```

### Import ATT&CK Data (if not done during install)

```bash
# Import MITRE ATT&CK data (all domains: Enterprise, ICS, Mobile)
docker-compose exec backend python manage.py import_mitre_universal \
  --mitre-version 19.0 --mode remote

# This downloads ~500MB of data and may take 5-10 minutes
```

### Configure Additional Features

#### SMTP/Email Notifications

Edit `.env` file:

```bash
EMAIL_ENABLED=True
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=postmaster@mg.example.com

# Store password in .secrets/mailgun_api
echo "your-api-key" > .secrets/mailgun_api
```

Restart backend:
```bash
docker-compose restart backend
```

#### MISP Threat Intelligence Integration

Edit `.env` file:

```bash
MISP_ENABLED=True
MISP_URL=https://misp.example.com
# Store API key in .secrets/misp_key
echo "your-api-key" > .secrets/misp_key
```

#### SSL Certificate Renewal (Let's Encrypt)

Auto-renewal is configured via cron:

```bash
# View renewal status
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew --force-renewal
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 80
sudo lsof -i :80

# Change port in docker-compose.yml or docker-compose.override.yml
ports:
  - "8080:80"  # Use 8080 instead of 80
```

### Out of Disk Space

```bash
# Clean up Docker
docker system prune -a

# Remove old backups
rm -rf /opt/hefaistos/backups/hefaistos_backup_202401*

# Check disk usage
df -h
du -sh /opt/hefaistos/*
```

### Containers Won't Start

```bash
# Check logs
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs nginx

# Restart with verbose output
docker-compose up --force-recreate
```

### Database Connection Failed

```bash
# Check if DB container is running
docker-compose ps db

# Access database shell
docker-compose exec db psql -U hefaistos_user -d hefaistos_db

# Check database password
cat .secrets/db_password

# Restart database
docker-compose restart db
```

### SSL Certificate Errors

**Self-signed certificate warning (normal):**
```
- Browser will show certificate warning
- Click "Proceed anyway" or "Advanced"
- This is expected and secure for internal use
```

**Invalid Let's Encrypt certificate:**
```bash
# Verify domain DNS resolution
nslookup app.example.com

# Check certificate validity
sudo certbot certificates

# Renew certificate
sudo certbot renew --force-renewal
```

### Frontend Can't Connect to Backend

```bash
# Check CORS configuration
grep CORS_ALLOWED_ORIGINS .env

# Verify backend is running via NGINX proxy
curl -s https://localhost:8443/graphql
# Or if using HTTP
curl -s http://localhost:8080/graphql

# Check nginx proxy configuration
docker-compose exec nginx cat /etc/nginx/conf.d/default.conf
```

### Firewall Blocks Access

```bash
# Check UFW status
sudo ufw status

# Allow specific port
sudo ufw allow 443/tcp

# Disable UFW temporarily (for testing)
sudo ufw disable

# Re-enable and configure
sudo ./scripts/setup-firewall.sh
```

---

## Uninstallation

### Backup Everything First

```bash
# Create a backup before uninstalling
bash ./scripts/backup-hefaistos.sh ./backups
```

### Safe Uninstall (Keep Data)

```bash
# Stop containers but keep database
sudo bash ./scripts/uninstall-hefaistos.sh --keep-data --keep-backups
```

### Complete Uninstall

```bash
# Remove everything including Docker images
sudo bash ./scripts/uninstall-hefaistos.sh --full-cleanup
```

### Restore from Backup

```bash
# Start containers
docker-compose up -d

# Restore database
gunzip -c backups/hefaistos_backup_20250108_021530.sql.gz | \
  docker-compose exec -T db psql -U hefaistos_user hefaistos_db

# Verify
docker-compose exec db psql -U hefaistos_user -d hefaistos_db -c "SELECT COUNT(*) FROM django_migrations;"
```

---

## Maintenance

### Automated Backups

Backups are configured automatically if you enabled them during installation.

**Manual backup:**
```bash
bash ./scripts/backup-hefaistos.sh ./backups 30
```

**Backup location:** `/opt/hefaistos/backups/`

**Backup files:**
- `hefaistos_backup_YYYYMMDD_HHMMSS.sql.gz` - Database backup
- `hefaistos_configs_YYYYMMDD_HHMMSS.tar.gz` - Configuration backup

**View cron schedule:**
```bash
crontab -l | grep backup-hefaistos
```

### Regular Updates

```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose build

# Apply any new migrations
docker-compose exec backend python manage.py migrate

# Restart services
docker-compose up -d
```

### Health Monitoring

```bash
# Check all containers status
docker-compose ps

# View live logs
docker-compose logs -f

# Check specific service
docker-compose logs -f backend

# Exit logs: Ctrl+C
```

### Log Files

```bash
# Installation logs
cat /opt/hefaistos/installation.log

# Uninstall logs
cat /opt/hefaistos/uninstall_*.log

# Backup logs
cat /opt/hefaistos/backups/backup_*.log

# View Docker logs
docker-compose logs
```

### Database Management

```bash
# Connect to database
docker-compose exec db psql -U hefaistos_user -d hefaistos_db

# Useful PostgreSQL commands:
# \dt                          - List all tables
# \du                          - List all users
# SELECT * FROM django_migrations;  - View migration status
# \l                           - List all databases
# \q                           - Quit psql
```

### Backup Restoration Test (Important!)

Periodically test backup restoration:

```bash
# Create a test database
docker-compose exec db createdb -U hefaistos_user hefaistos_test

# Restore backup
gunzip -c backups/hefaistos_backup_20250108_021530.sql.gz | \
  docker-compose exec -T db psql -U hefaistos_user hefaistos_test

# Verify
docker-compose exec db psql -U hefaistos_user -d hefaistos_test -c "SELECT COUNT(*) FROM django_migrations;"

# Clean up test database
docker-compose exec db dropdb -U hefaistos_user hefaistos_test
```

---

## Useful Commands Reference

```bash
# Start all containers
docker-compose up -d

# Stop all containers (preserves data)
docker-compose stop

# Restart specific service
docker-compose restart backend

# View real-time logs
docker-compose logs -f

# Execute management command
docker-compose exec backend python manage.py [command]

# Access database shell
docker-compose exec db psql -U hefaistos_user -d hefaistos_db

# Access backend container shell
docker-compose exec backend bash

# Check disk usage
docker system df

# Clean up unused images
docker system prune -a

# Update a specific image
docker pull python:3.11-slim && docker-compose up -d

# View resource usage
docker stats

# Rebuild containers (without stopping)
docker-compose build

# Force recreate containers
docker-compose up -d --force-recreate

# View environment variables
docker-compose exec backend env | grep HEFAISTOS
```

---

## Support & Documentation

- **GitHub Repository:** https://github.com/hefaistos-platform/hefaistos
- **Issue Tracker:** https://github.com/hefaistos-platform/hefaistos/issues
- **Documentation:** `/opt/hefaistos/Docs/`
- **README:** `/opt/hefaistos/README.md`

---

## Security Checklist

After installation, ensure you have:

- [ ] Changed admin password
- [ ] Updated `SECRET_KEY` in `.env`
- [ ] Set `FRONTEND_URL` in `.env` to your public domain
- [ ] Set `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` in `.env`
- [ ] Configured SSL certificates (not self-signed for production)
- [ ] Set up firewall rules (UFW)
- [ ] Enabled automated backups
- [ ] Restricted admin panel IP access (`ADMIN_ALLOWED_IP_RANGES` in `.env`)
- [ ] Configured HTTPS redirects
- [ ] Tested backup restoration
- [ ] Set up monitoring/alerting
- [ ] Documented custom configurations
- [ ] Reviewed audit logs regularly

---

## Document Information

- **Version:** 1.0
- **Updated:** January 2025
- **Installation Script:** `install-hefaistos.sh`
- **Backup Script:** `scripts/backup-hefaistos.sh`
- **Uninstall Script:** `scripts/uninstall-hefaistos.sh`
- **Firewall Script:** `scripts/setup-firewall.sh`
