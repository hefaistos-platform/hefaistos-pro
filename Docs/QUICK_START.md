# HEFAISTOS QUICK START

## 30-Second Installation

```bash
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos
chmod +x install-hefaistos.sh
sudo ./install-hefaistos.sh
```

**That's it!** The script will guide you through configuration and start your platform.

---

## What Gets Installed

✅ Docker & Docker Compose  
✅ PostgreSQL Database  
✅ RabbitMQ Message Broker  
✅ Django Backend API  
✅ React Frontend  
✅ Nginx Reverse Proxy  
✅ SSL/TLS Certificates  
✅ Automated Backups (optional)  
✅ Firewall Configuration (optional)  
✅ ATT&CK Framework Data (optional)  

**Estimated Time:** 15-30 minutes

---

## System Requirements

- **OS:** Ubuntu 20.04 or newer
- **RAM:** 4GB minimum (8GB+ recommended)
- **Disk:** 10GB+ available
- **CPU:** 2+ cores
- **Internet:** Required for setup

---

## Installation Steps Explained

### Step 1: Choose Installation Location

```bash
# Default: /opt/hefaistos
sudo ./install-hefaistos.sh

# Custom location:
sudo ./install-hefaistos.sh /custom/path/hefaistos
```

### Step 2: Answer Configuration Questions

The script will ask you for:

1. **Server Domain/IP** - Where you'll access the platform
   - Examples: `app.example.com`, `192.168.1.100`

2. **SSL Certificate Type**
   - Self-signed (instant, local/testing)
   - Let's Encrypt (free, production-grade, requires domain)

3. **CORS Origins** - URLs that can access the API
   - Default includes your domain and localhost

4. **Admin IP Restrictions** - Who can access the admin panel
   - Default: Private networks only (safe default)

5. **Database Password** - Random generated or your own

6. **Superuser Account** - Your admin login credentials
   - Email and password

7. **Optional Features**
   - Firewall configuration (UFW)
   - Automated backups
   - ATT&CK data import
   - MISP integration

### Step 3: Wait for Setup

The script will:
- Install Docker and dependencies
- Clone your repository
- Generate and secure all secrets
- Build Docker containers
- Start all services
- Run database migrations
- Create your superuser account
- Generate a detailed report

### Step 4: Access Your Platform

**Frontend (Web Interface)**
```
https://app.example.com
Username: admin
Password: [the one you created]
```

**Admin Panel**
```
https://app.example.com/admin
```

**GraphQL API**
```
https://app.example.com/graphql
```

---

## After Installation

### Verify Everything Works

```bash
cd /opt/hefaistos

# Check containers
docker-compose ps

# View logs
docker-compose logs -f

# Test API
curl -s https://app.example.com/graphql | head -c 100
```

### Import ATT&CK Data (if not done during install)

```bash
docker-compose exec backend python manage.py import_mitre_universal \
  --mitre-version 19.0 --mode remote
```

This downloads all MITRE ATT&CK data (Enterprise, ICS, Mobile techniques).

### Create Backups

```bash
bash ./scripts/backup-hefaistos.sh ./backups
```

Or setup automated daily backups during installation.

---

## Common Issues & Fixes

**"Permission denied" error**
```bash
# Use sudo
sudo ./install-hefaistos.sh
```

**"Docker command not found"**
```bash
# Docker was just installed, may need to restart terminal or:
sudo usermod -aG docker $USER
```

**"Port already in use"**
```bash
# Edit docker-compose.yml and change ports
# Then restart: docker-compose up -d --force-recreate
```

**Containers won't start**
```bash
# Check logs
docker-compose logs

# Restart
docker-compose restart
```

**Can't access from another computer**
```bash
# Check firewall rules
sudo ufw status

# Allow port
sudo ufw allow 443/tcp
```

---

## Useful Commands After Installation

```bash
# View all containers and status
docker-compose ps

# See live logs
docker-compose logs -f

# See specific service logs
docker-compose logs -f backend

# Stop all services (keeps data)
docker-compose stop

# Start all services
docker-compose start

# Restart everything
docker-compose restart

# Access database directly
docker-compose exec db psql -U hefaistos_user -d hefaistos_db

# Access backend shell
docker-compose exec backend bash

# Run management command
docker-compose exec backend python manage.py [command]

# Backup database
bash ./scripts/backup-hefaistos.sh ./backups

# Create a new superuser
docker-compose exec backend python manage.py createsuperuser
```

---

## Security First-Steps

After installation:

1. **Change admin password** (login and update)
2. **Review firewall rules** - `sudo ufw status`
3. **Check CORS configuration** - Should only include your domain
4. **Review admin IP restrictions** - Who can access /admin/?
5. **Enable HTTPS** - Already done if using Let's Encrypt or domain
6. **Backup everything** - `bash ./scripts/backup-hefaistos.sh`
7. **Test backup restore** - Make sure backups work

---

## Need Help?

1. **Installation Report** - Read it! Located at `/opt/hefaistos/INSTALLATION_REPORT.txt`
2. **Full Guide** - See `CLEAN_INSTALL.md` in repository root
3. **Logs** - Check `installation.log` for any issues
4. **Docker Logs** - `docker-compose logs [service_name]`
5. **GitHub Issues** - https://github.com/hefaistos-platform/hefaistos/issues

---

## Uninstall (if needed)

```bash
# Keep your data
sudo ./scripts/uninstall-hefaistos.sh --keep-data --keep-backups

# Full cleanup (remove everything)
sudo ./scripts/uninstall-hefaistos.sh --full-cleanup

# Restore from backup
gunzip -c backups/hefaistos_backup_*.sql.gz | \
  docker-compose exec -T db psql -U hefaistos_user hefaistos_db
```

---

## Directory Structure

```
hefaistos/
├── install-hefaistos.sh          ← Run this to install
├── CLEAN_INSTALL.md              ← Full documentation
├── INSTALLATION_SUITE_SUMMARY.md ← Technical details
├── .env.template                 ← Config template
├── docker-compose.yml            ← Service definitions
├── docker-compose.override.yml   ← Dev overrides (created by installer)
├── .secrets/                     ← Created with credentials
├── backups/                      ← Your database backups
├── backend/                      ← Django application
├── frontend/                     ← React application
├── nginx/                        ← Web server config
└── scripts/
    ├── backup-hefaistos.sh       ← Manual backup
    ├── uninstall-hefaistos.sh    ← Safe removal
    └── setup-firewall.sh         ← Firewall config
```

---

## What's Next?

✅ Installation complete  
→ Configure integrations (MISP, Email, etc.)  
→ Import threat intelligence data  
→ Configure users and organizations  
→ Deploy playbooks and detection rules  
→ Monitor and maintain backups  

---

**Ready to install?**

```bash
sudo ./install-hefaistos.sh
```

All questions are answered interactively with helpful defaults provided.
