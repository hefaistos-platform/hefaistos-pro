# HEFAISTOS Platform - Complete Installation Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Initial Setup](#initial-setup)
4. [Secrets Configuration](#secrets-configuration)
5. [SSL Certificates](#ssl-certificates)
6. [Network Configuration](#network-configuration)
7. [Starting the Platform](#starting-the-platform)
8. [Creating Superuser](#creating-superuser)
9. [Setting User Roles](#setting-user-roles)
10. [Importing MITRE ATT&CK Data](#importing-mitre-attck-data)
11. [Post-Installation](#post-installation)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Docker Engine**: Version 20.10 or higher
- **Docker Compose**: V2 (plugin version recommended)
- **Git**: For cloning the repository
- **OpenSSL**: For generating encryption keys and SSL certificates

### System Requirements
- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB+ available disk space
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+), macOS, or Windows with WSL2

---

## Initial Setup

### 1. Clone the Repository
```bash
git clone https://github.com/hefaistos-platform/hefaistos.git
cd hefaistos
```

### 2. Create Required Directories
```bash
mkdir -p .secrets
mkdir -p backups
mkdir -p nginx/certs
```

---

## Secrets Configuration

The platform requires several secrets to be configured in the `.secrets/` directory. **Never commit these files to version control.**

### 1. Field Encryption Key (CRITICAL)
This Fernet key encrypts sensitive data in the database (API keys, tokens, credentials).

**Method 1: Use the provided script (RECOMMENDED)**
```bash
chmod +x setup_field_encryption_key.sh
./setup_field_encryption_key.sh
```

**Method 2: Generate with Docker (if cryptography not installed locally)**
```bash
docker run --rm python:3.11-slim python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > .secrets/field_key
chmod 600 .secrets/field_key
```

**Method 3: Generate with OpenSSL (fallback method)**
```bash
openssl rand 32 | openssl enc -base64 -A | tr '+/' '-_' > .secrets/field_key
chmod 600 .secrets/field_key
```

**⚠️ CRITICAL WARNING**: 
- Losing this key means **permanent data loss** for all encrypted fields
- Back up `.secrets/field_key` to a secure location immediately
- Without this key, encrypted credentials and tokens cannot be recovered
- The key is stored at `.secrets/field_key` (not in version control)

### 2. Database Password
```bash
# Generate a strong password (example)
openssl rand -base64 32 > .secrets/db_password
chmod 600 .secrets/db_password
```

### 3. RabbitMQ Password
```bash
openssl rand -base64 32 > .secrets/rabbitmq_pass
chmod 600 .secrets/rabbitmq_pass
```
Docker Compose mounts this secret inside containers at `/run/secrets/rabbitmq_pass`; keep the filename exactly as shown so the mount path resolves.

### 4. API Token
```bash
# Generate a strong password (example)
openssl rand -base64 32 > .secrets/api_token
chmod 600 .secrets/api_token
```

### 5. Optional: MISP API Key
If using MISP threat intelligence integration:
```bash
echo "YOUR_MISP_API_KEY" > .secrets/misp_key
chmod 600 .secrets/misp_key
```

### 6. Optional: Mailgun API Key
If using email notifications:
```bash
echo "YOUR_MAILGUN_API_KEY" > .secrets/mailgun_api
chmod 600 .secrets/mailgun_api
```

### Verify Secrets
```bash
ls -la .secrets/
# Should show: field_key, db_password, rabbitmq_pass (and optional misp_key, mailgun_api)
```

---

## SSL Certificates

### Development (Self-Signed)
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/hefaistos.key \
  -out nginx/certs/hefaistos.crt \
  -subj "/CN=localhost"
```

### Production
Place your SSL certificates in `nginx/certs/`:
- `hefaistos.crt` (certificate)
- `hefaistos.key` (private key)

Update `nginx/conf.d/hefaistos.conf` to reference your certificates.

---

## Network Configuration

All network-specific settings (CORS, CSRF, admin IP restrictions) are configured through **environment variables** in the `.env` file. No source-code edits to `settings.py` are required or recommended — doing so would break portability across deployments.

### Files to Modify for Different Network

#### 1. `.env` — the single source of truth for your deployment

```bash
# Domain your browser uses to access the platform
SERVER_DOMAIN=app.example.com

# Public URL (used in email links)
FRONTEND_URL=https://app.example.com
PUBLIC_BASE_URL=https://app.example.com

# Trusted CSRF origins — must match the URL the browser sends requests from.
# Comma-separated list.
CSRF_TRUSTED_ORIGINS=https://app.example.com,http://app.example.com

# Additional CORS origins (mitre-attack.github.io is always included automatically).
# Only needed for external tools that fetch data from the API.
# Leave empty for a standard single-domain deployment.
CORS_ALLOWED_ORIGINS=https://app.example.com,http://app.example.com

# IP ranges (CIDR) allowed to access /admin/.
# Defaults to localhost and Docker internal networks.
ADMIN_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12
```

After editing `.env`, restart the backend (and nginx if the domain changed):

```bash
docker compose restart backend
# If you also changed SERVER_DOMAIN in nginx config:
docker compose restart nginx
```

#### 2. `nginx/conf.d/hefaistos.conf` — nginx reverse proxy

The nginx config uses `server_name` and SSL certificate paths. The install script updates these automatically. You only need to edit it manually if you are changing the domain after installation:

```nginx
server {
    listen 8443 ssl;
    server_name app.example.com;   # ← Change to your domain

    ssl_certificate  /etc/nginx/certs/hefaistos.crt;
    ssl_certificate_key /etc/nginx/certs/hefaistos.key;
    # ...
}
```

**Media files (avatars, snapshots)** are served directly by Nginx at `/media/` with permissive CORS headers (`*`) by default, so they load correctly from any browser origin without any additional configuration. If you need to restrict media access to a specific origin, change the `Access-Control-Allow-Origin` header in the `/media/` location block:

```nginx
location /media/ {
    alias /var/www/media/;
    # Restrict to your domain instead of "*":
    add_header Access-Control-Allow-Origin "https://app.example.com" always;
}
```

After changing Nginx config, restart the proxy:
```bash
docker compose restart nginx
```

---

## Starting the Platform

### 1. Build Containers
```bash
docker compose build
```

### 2. Start Services
```bash
docker compose up -d
```

### 3. Verify All Services Are Running
```bash
docker compose ps
```

Expected services:
- `backend` (Django)
- `frontend` (React + Nginx)
- `db` (PostgreSQL)
- `rabbitmq` (Message Queue)
- `elasticsearch` (Search)
- `nginx` (Reverse Proxy)
- Various connectors (deploy_connector, rule_connector, etc.)

### 4. Check Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Creating Superuser

After the platform is running, you need to create an admin superuser account.

### Method 1: Interactive Creation
```bash
docker compose exec backend python manage.py createsuperuser
```

You'll be prompted for:
- **Username**: Your admin username
- **Email**: Admin email address
- **Password**: Strong password (will be prompted twice)

### Method 2: Non-Interactive (Automated)
```bash
docker compose exec backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@hefaistos.local', 'YourStrongPassword123!')
    print('Superuser created successfully')
else:
    print('Superuser already exists')
EOF
```

### Method 3: Create Multiple Users
```bash
docker compose exec backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()

users = [
    {'username': 'admin', 'email': 'admin@hefaistos.local', 'password': 'AdminPass123!', 'is_superuser': True},
    {'username': 'operator', 'email': 'operator@hefaistos.local', 'password': 'OperatorPass123!', 'is_superuser': False},
]

for user_data in users:
    if not User.objects.filter(username=user_data['username']).exists():
        if user_data['is_superuser']:
            User.objects.create_superuser(user_data['username'], user_data['email'], user_data['password'])
        else:
            User.objects.create_user(user_data['username'], user_data['email'], user_data['password'])
        print(f"User {user_data['username']} created successfully")
    else:
        print(f"User {user_data['username']} already exists")
EOF
```

### Verify Superuser Login
1. Navigate to `https://your-server/admin/` (or your configured URL)
2. Login with your superuser credentials
3. You should see the Django admin interface

---

## Setting User Roles

HEFAISTOS has application-level roles that control access to certain features. Being a Django superuser (`is_superuser=True`) is **NOT the same** as having the application `ADMIN` role.

### Available Roles
- **USER**: Standard user access
- **ADMIN**: Full access including User Management and News Management menus

### Method 1: Via Django Admin
1. Navigate to `https://your-server/admin/`
2. Go to **Identity > Custom users**
3. Click on your user
4. Change the **Role** field to `ADMIN`
5. Save

### Method 2: Via Command Line
```bash
docker compose exec backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='YOUR_USERNAME')
user.role = 'ADMIN'
user.save()
print(f"User {user.username} role set to: {user.role}")
EOF
```

Replace `YOUR_USERNAME` with the actual username.

### Method 3: Create Admin User with Role
```bash
docker compose exec backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    user = User.objects.create_superuser('admin', 'admin@hefaistos.local', 'YourStrongPassword123!')
    user.role = 'ADMIN'
    user.save()
    print('Admin superuser created with ADMIN role')
else:
    user = User.objects.get(username='admin')
    user.role = 'ADMIN'
    user.save()
    print('Existing admin user updated with ADMIN role')
EOF
```

After setting the role, **refresh the frontend page** to see the User Management and News Management menu items.

---

## Importing MITRE ATT&CK Data

The platform includes a management command to import MITRE ATT&CK framework data (techniques, detection strategies, and analytics). This data powers the Coverage Map and technique mappings throughout the platform.

### Import from Remote (Recommended)
Downloads the latest ATT&CK data directly from MITRE:

```bash
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote
```

This will import:
- **Enterprise ATT&CK** techniques
- **ICS ATT&CK** techniques  
- **Mobile ATT&CK** techniques
- Detection Strategies
- Analytics
- Technique-Strategy relationships

### Import D3FEND Framework Data

After importing MITRE ATT&CK data, import the MITRE D3FEND defensive technique ontology:

```bash
docker compose exec backend python manage.py import_d3fend
```

This imports ~267 defensive techniques and maps them to ATT&CK techniques for gap analysis.

Optional: Use `--verbose` flag to see detailed import progress:

```bash
docker compose exec backend python manage.py import_d3fend --verbose
```

### Import from Local Files
If you have downloaded the MITRE Excel files locally:

1. Download the Excel files from [MITRE ATT&CK](https://attack.mitre.org/resources/attack-data-and-tools/):
   - `enterprise-attack-v19.0.xlsx`
   - `ics-attack-v19.0.xlsx`
   - `mobile-attack-v19.0.xlsx`

2. Place them in a directory accessible to the container (e.g., `./backend/data/mitre/`)

3. Run the import:
```bash
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode local --dir /app/data/mitre
```

### Import Different Versions
To import a specific MITRE ATT&CK version:
```bash
# Version 17
docker compose exec backend python manage.py import_mitre_universal --mitre-version 17.0 --mode remote

# Version 19.0 (current)
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote
```

### Verify Import
After import, verify the data in Django admin:
1. Go to `https://your-server/admin/`
2. Navigate to **Platform_data > Mitre attack techniques**
3. You should see techniques like T1001, T1002, etc.

Or via command line:
```bash
docker compose exec backend python manage.py shell << EOF
from platform_data.models import MitreAttackTechnique, MitreDetectionStrategy, MitreAnalytic
print(f"Techniques: {MitreAttackTechnique.objects.count()}")
print(f"Detection Strategies: {MitreDetectionStrategy.objects.count()}")
print(f"Analytics: {MitreAnalytic.objects.count()}")
EOF
```

### Troubleshooting Import
If the remote import fails:
```bash
# Check network connectivity from container
docker compose exec backend curl -I https://attack.mitre.org

# Try with verbose output
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote --verbosity 2
```

---

## Post-Installation

### 1. Run Database Migrations
```bash
docker compose exec backend python manage.py migrate
```

Note: Do NOT run `makemigrations` in production - migrations should come from the repository.

### 2. Collect Static Files
```bash
docker compose exec backend python manage.py collectstatic --noinput
```

### 3. Import MITRE ATT&CK Data
```bash
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote
```

### 4. Import MITRE D3FEND Data
```bash
docker compose exec backend python manage.py import_d3fend
```

This imports ~267 defensive techniques and creates ATT&CK → D3FEND mappings for gap analysis. Use `--verbose` for detailed output.

### 5. Access the Platform
- **Frontend**: `https://your-server` (or your configured URL)
- **Backend API**: `https://your-server/graphql`
- **Admin Panel**: `https://your-server/admin/`

### 6. Configure Backups
See `backups/BACKUP_README.md` or `scripts/BACKUP_SETUP.md` for backup configuration.

### 7. Configure Email URLs

Email notification links use `FRONTEND_URL`. Shareable links (for example L1 Portal URLs embedded into OpenTIDE outputs) use `PUBLIC_BASE_URL` first. Set both in `.env` to your external domain:

```bash
# In .env
FRONTEND_URL=https://your-domain.com
PUBLIC_BASE_URL=https://your-domain.com
```

The install script sets both automatically from `SERVER_DOMAIN`. If you need to change them later, update `.env` and restart the backend:

```bash
docker compose restart backend
```

### 8. Configure Connectors
- See `Docs/SETUP_DEPLOY_CONNECTOR.md` for deployment connector setup
- Configure other connectors as needed (git_push, notification, threat_intel, rule)

---

## Troubleshooting

### Services Not Starting
```bash
# Check logs for specific service
docker compose logs backend
docker compose logs db

# Restart specific service
docker compose restart backend

# Rebuild and restart
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

### Database Connection Issues
- Verify `.secrets/db_password` exists and matches `docker-compose.yml`
- Check PostgreSQL logs: `docker compose logs db`
- Ensure database container is healthy: `docker compose ps`

### Field Encryption Errors
```
django.core.exceptions.ImproperlyConfigured: FIELD_ENCRYPTION_KEY_FILE not configured
```
- Ensure `.secrets/field_key` exists
- Verify file is readable: `cat .secrets/field_key`
- Re-generate if needed: `./setup_field_encryption_key.sh`
- Check file permissions: `chmod 600 .secrets/field_key`

### RabbitMQ Connection Failures
- Check `.secrets/rabbitmq_pass` exists
- Verify RabbitMQ is running: `docker compose ps rabbitmq`
- Check logs: `docker compose logs rabbitmq`

### CORS/CSRF Errors
- Verify `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` in `.env` include your server's public URL
- Ensure the `FRONTEND_URL` in `.env` matches your domain
- After any `.env` change, restart the backend: `docker compose restart backend`

### SSL Certificate Issues
- For development, accept self-signed certificate in browser
- For production, ensure certificates are valid and not expired
- Check nginx configuration: `docker compose logs nginx`

### Permission Denied Errors
```bash
# Fix ownership of critical directories
sudo chown -R $(whoami):$(whoami) .secrets/
sudo chmod 700 .secrets/
sudo chmod 600 .secrets/*
```

### Port Already in Use
```bash
# Check what's using the public ports
sudo lsof -i :443
sudo lsof -i :80

# If needed, remap host ports in docker-compose.override.yml
# while keeping container ports 8080/8443 unchanged.
```

### Elasticsearch Issues
```bash
# Check Elasticsearch logs
docker compose logs elasticsearch

# May need to increase vm.max_map_count on Linux
sudo sysctl -w vm.max_map_count=262144
```

### User Management / News Management Not Visible
If you're logged in as a superuser but don't see User Management or News Management in the sidebar:
- Your user needs the **ADMIN role** (not just Django superuser status)
- See [Setting User Roles](#setting-user-roles) section above
- After setting the role, refresh the frontend page

### MITRE ATT&CK Data Not Loading
```bash
# Check if data was imported
docker compose exec backend python manage.py shell -c "from platform_data.models import MitreAttackTechnique; print(MitreAttackTechnique.objects.count())"

# Re-run import if needed
docker compose exec backend python manage.py import_mitre_universal --mitre-version 19.0 --mode remote
```

### Reset Everything (⚠️ DESTRUCTIVE)
```bash
docker compose down -v  # Removes all volumes (data loss!)
rm -rf .secrets/*       # Remove secrets (if regenerating)
# Then start from Initial Setup
```

---

## Additional Resources

- **ACH User Guide**: `Docs/ACH_USER_GUIDE.md`
- **Attack Navigator Setup**: `Docs/ATTACK_NAVIGATOR_SETUP.md`
- **Backup Configuration**: `Docs/BACKUP_README.md`
- **Debug GraphQL**: `Docs/DEBUG_GRAPHQL.md`
- **AI Model Updates**: `Docs/AI_MODEL_UPDATES.md`

---

## Security Best Practices

1. **Never commit secrets to git** - Use `.gitignore` for `.secrets/` directory
2. **Use strong passwords** - Minimum 16 characters, mixed case, numbers, symbols
3. **Backup encryption key** - Store `.secrets/field_key` in secure password manager
4. **Keep Docker images updated** - Regularly run `docker compose pull` and rebuild
5. **Restrict admin access** - Configure `ADMIN_ALLOWED_IP_RANGES` appropriately
6. **Use production SSL** - Replace self-signed certificates in production
7. **Regular backups** - Schedule automated backups using provided scripts
8. **Monitor logs** - Set up log aggregation and alerting
9. **Update dependencies** - Keep Python/Node packages updated for security patches

---

## Support

For issues, questions, or contributions:
- **Repository**: https://github.com/hefaistos-platform/hefaistos
- **Issues**: https://github.com/hefaistos-platform/hefaistos/issues

---

**Version**: 1.2  
**Last Updated**: February 10, 2026  
**Maintained by**: HEFAISTOS Platform Team
