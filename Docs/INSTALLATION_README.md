# HEFAISTOS INSTALLATION SUITE - COMPLETE SETUP SYSTEM

**Production-ready automated installation and deployment system for Hefaistos platform**

---

## 🚀 Quick Links

| Document | Purpose | Time |
|----------|---------|------|
| **[QUICK_START.md](QUICK_START.md)** | 30-second installation walkthrough | 2 min read |
| **[CLEAN_INSTALL.md](CLEAN_INSTALL.md)** | Comprehensive step-by-step guide | 15 min read |
| **[INSTALLATION_SUITE_SUMMARY.md](INSTALLATION_SUITE_SUMMARY.md)** | Technical details of all components | 10 min read |

---

## ⚡ 30-Second Start

```bash
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos
chmod +x install-hefaistos.sh
sudo ./install-hefaistos.sh
```

**What you need:**
- Ubuntu 20.04+
- 4GB RAM
- 10GB disk space
- Internet connection
- Root access (sudo)

---

## 📦 What Gets Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| Docker | Latest | Container runtime |
| PostgreSQL | 15 | Database |
| RabbitMQ | 3.12+ | Message broker |
| Django | 5.2.7 | Backend API |
| React | Latest | Frontend UI |
| Nginx | Latest | Reverse proxy |
| Python | 3.11+ | Backend runtime |

**Features Included:**
- ✅ SSL/TLS certificates (self-signed or Let's Encrypt)
- ✅ Automated database backups with retention
- ✅ UFW firewall configuration
- ✅ ATT&CK framework data import
- ✅ Superuser account setup
- ✅ Health checks and validation
- ✅ Comprehensive installation report

---

## 📂 Installation Scripts

### Main Installation Script: `install-hefaistos.sh`

**600+ lines, production-ready automation**

```bash
sudo ./install-hefaistos.sh
```

**What it does:**
1. System requirements validation
2. Docker installation
3. Repository setup
4. Interactive configuration
5. Secrets generation
6. SSL certificate creation
7. Configuration file updates
8. Container build and startup
9. Database migrations
10. Superuser creation
11. Optional: ATT&CK data import
12. Optional: Firewall setup
13. Optional: Backup automation
14. Generate installation report

**Configuration Options:**
- Server domain/IP
- SSL certificate type (self-signed or Let's Encrypt)
- CORS origins (API access)
- Admin IP restrictions
- Database credentials
- Superuser credentials
- Feature toggles (firewall, backups, data import)

**Output:**
- `INSTALLATION_REPORT.txt` - Complete setup summary
- `installation.log` - Detailed installation log
- `.secrets/` - Generated secrets directory
- `docker-compose.yml` - Updated with your config

---

### Backup Script: `scripts/backup-hefaistos.sh`

**200+ lines, automated backup management**

```bash
bash ./scripts/backup-hefaistos.sh /backups 30
```

**Features:**
- Database backup (PostgreSQL)
- Configuration backup
- Integrity verification
- Automatic rotation
- Restoration instructions

**Usage:**
- Manual: `bash scripts/backup-hefaistos.sh`
- Automated: Set up cron job (done by installer if enabled)

**Output:**
- `hefaistos_backup_YYYYMMDD_HHMMSS.sql.gz` - Database dump
- `hefaistos_configs_YYYYMMDD_HHMMSS.tar.gz` - Configs backup
- `backup_YYYYMMDD_HHMMSS.log` - Backup log

---

### Uninstall Script: `scripts/uninstall-hefaistos.sh`

**280+ lines, safe removal with data preservation**

```bash
sudo ./scripts/uninstall-hefaistos.sh
```

**Options:**
- `--keep-data` - Preserve database and media
- `--keep-backups` - Preserve backup files
- `--full-cleanup` - Remove Docker images too

**Safe Process:**
1. Interactive confirmation
2. Create final backup before removal
3. Stop containers gracefully
4. Optional data preservation
5. Remove cron jobs
6. Cleanup complete with logging

---

### Firewall Helper: `scripts/setup-firewall.sh`

**350+ lines, UFW firewall configuration**

```bash
sudo ./scripts/setup-firewall.sh
```

**Features:**
- Interactive menu system
- Safe default rules
- Allow/deny specific IPs
- Rule management
- Logging

**Default Rules:**
- SSH (22) - Always allowed
- HTTP (80) - Allowed
- HTTPS (443) - Allowed
- Public API via NGINX (8080/8443) - Allowed
- Internal backend (8000) - Restricted to container network
- Private networks - Allowed
- Docker bridge - Allowed

---

## 📋 Configuration Templates

### `.env.template`

Environment configuration with:
- Django settings
- Database config
- RabbitMQ settings
- CORS/CSRF settings
- Optional integrations
- SSL configuration

**Usage:**
```bash
cp .env.template .env
# Edit .env with your values
```

### `docker-compose.override.yml.template`

Development overrides for:
- Local builds
- Port exposure
- Volume mounts
- Debug logging

**Usage:**
```bash
cp docker-compose.override.yml.template docker-compose.override.yml
# Customize for your dev environment
```

---

## 📚 Documentation

### QUICK_START.md
- 30-second installation
- Common issues
- Useful commands
- Post-installation steps

### CLEAN_INSTALL.md (Main Guide)
- Detailed requirements
- Step-by-step walkthrough
- Configuration explanation
- Post-installation setup
- Troubleshooting guide
- Maintenance procedures
- Security checklist

### INSTALLATION_SUITE_SUMMARY.md (Technical Details)
- Complete feature list
- Installation flow diagram
- File structure
- Usage scenarios
- Version information

---

## 🔐 Security Features

**Built-in Security:**
- ✅ Secrets management (.secrets/ directory)
- ✅ Field encryption key generation
- ✅ Database password protection
- ✅ RabbitMQ password security
- ✅ JWT secret generation
- ✅ SSL/TLS certificates
- ✅ Admin IP whitelist
- ✅ UFW firewall support
- ✅ Secure backup procedures

**Post-Installation Security:**
- Review admin password
- Configure CORS origins
- Review admin IP restrictions
- Enable HTTPS
- Setup backup automation
- Regular security updates

---

## 🔧 Common Tasks

### View Installation Report

```bash
cat INSTALLATION_REPORT.txt
```

### Check Container Status

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Create Manual Backup

```bash
bash scripts/backup-hefaistos.sh ./backups
```

### Access Database

```bash
docker-compose exec db psql -U hefaistos_user -d hefaistos_db
```

### Uninstall Cleanly

```bash
sudo scripts/uninstall-hefaistos.sh --keep-data --keep-backups
```

---

## ⚙️ Configuration Customization

### Change Domain After Installation

```bash
# Update .env
sed -i 's/old.example.com/new.example.com/g' .env

# Update nginx
sed -i 's/old.example.com/new.example.com/g' nginx/nginx.conf

# Restart containers
docker-compose restart
```

### Add Admin User Restriction

```bash
# Edit .env
ADMIN_ALLOWED_IP_RANGES=192.168.1.0/24,10.0.0.1

# Restart
docker-compose restart backend
```

### Enable Email Notifications

```bash
# Edit .env
EMAIL_ENABLED=True
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_HOST_USER=postmaster@mg.example.com

# Add password
echo "api-key" > .secrets/mailgun_api

# Restart
docker-compose restart backend
```

---

## 📊 Installation Flow

```
START: sudo ./install-hefaistos.sh
  ↓
Pre-flight Checks (OS, disk, internet)
  ↓
Install Dependencies (Docker, tools)
  ↓
Repository Setup
  ↓
USER INPUT COLLECTION
  ├─ Domain/IP
  ├─ SSL type
  ├─ CORS origins
  ├─ Admin IPs
  ├─ Database password
  ├─ Superuser
  └─ Feature selections
  ↓
Generate Secrets
  ├─ Field encryption key
  ├─ Database password
  ├─ RabbitMQ password
  └─ JWT secret
  ↓
Create SSL Certificates
  ├─ Self-signed (instant)
  └─ Let's Encrypt (validated)
  ↓
Update Configurations
  ├─ .env (CORS, CSRF, domain, secrets)
  ├─ nginx.conf (server_name, SSL paths)
  ↓
Docker Build & Start
  ├─ Build images
  ├─ Start containers
  └─ Health checks
  ↓
Database Setup
  ├─ Migrations
  └─ Superuser creation
  ↓
OPTIONAL: ATT&CK Data Import
OPTIONAL: Firewall Setup
OPTIONAL: Backup Automation
  ↓
Generate Installation Report
  ↓
COMPLETE ✓
  Access: https://app.example.com
```

---

## 🆘 Troubleshooting

**Installation fails?**
- Check `installation.log`
- Review `docker-compose logs`
- Ensure sudo privileges
- Verify internet connection

**Can't access platform?**
- Check firewall: `sudo ufw status`
- Verify containers: `docker-compose ps`
- Check DNS: `nslookup app.example.com`
- Review logs: `docker-compose logs nginx`

**Database issues?**
- Connect: `docker-compose exec db psql -U hefaistos_user -d hefaistos_db`
- Check migrations: `SELECT * FROM django_migrations;`
- View logs: `docker-compose logs db`

**Backup issues?**
- Check log: `cat backups/backup_*.log`
- Verify containers: `docker-compose ps`
- Test manually: `bash scripts/backup-hefaistos.sh ./backups`

---

## 📞 Support & Documentation

- **Full Guide:** `CLEAN_INSTALL.md`
- **Quick Start:** `QUICK_START.md`
- **Technical Details:** `INSTALLATION_SUITE_SUMMARY.md`
- **Installation Log:** `installation.log`
- **Setup Report:** `INSTALLATION_REPORT.txt`
- **GitHub Issues:** https://github.com/hefaistos-platform/hefaistos/issues
- **Documentation:** `/opt/hefaistos/Docs/`

---

## ✅ Post-Installation Checklist

- [ ] Access frontend: https://app.example.com
- [ ] Login with superuser credentials
- [ ] Access admin panel: /admin
- [ ] Check GraphQL API: /graphql
- [ ] Verify containers: `docker-compose ps`
- [ ] Review firewall rules (if enabled)
- [ ] Test backup creation
- [ ] Import ATT&CK data (if not done)
- [ ] Create additional users
- [ ] Configure integrations (optional)
- [ ] Setup monitoring (optional)
- [ ] Review security checklist

---

## 📝 Version Information

- **Suite Version:** 1.0 Production Ready
- **Created:** January 2025
- **Tested on:** Ubuntu 20.04 LTS, 22.04 LTS
- **Python:** 3.11+
- **Docker:** 20.10+ (with Compose v2)
- **PostgreSQL:** 15
- **RabbitMQ:** 3.12+

---

## 🎯 What's Next?

1. ✅ Run installation script
2. ✅ Complete configuration prompts
3. ✅ Access platform
4. ✅ Create user accounts
5. ✅ Import threat intelligence
6. ✅ Deploy detection playbooks
7. ✅ Monitor and maintain

---

**Ready to install Hefaistos?**

```bash
sudo ./install-hefaistos.sh
```

**Need help?** Read [QUICK_START.md](QUICK_START.md) or [CLEAN_INSTALL.md](CLEAN_INSTALL.md)

---

Generated: January 8, 2025 | Version 1.0 Production Ready ✅
