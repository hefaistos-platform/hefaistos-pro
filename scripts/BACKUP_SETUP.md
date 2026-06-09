# Hefaistos Backup Setup Guide

## Overview
The `backup-hefaistos.sh` script creates compressed backups of your Hefaistos installation and uploads them to a remote server via SSH/SCP using password authentication stored in your `.secrets` folder.

## Prerequisites
- Docker and Docker Compose v2
- SSH access to a remote backup server
- `sshpass` installed for password authentication
- Sufficient disk space on both local and remote systems

## Quick Setup

### 1. Install sshpass

```bash
# Debian/Ubuntu
sudo apt install sshpass

# RHEL/CentOS/Rocky
sudo yum install sshpass

# macOS (using Homebrew)
brew install hudochenkov/sshpass/sshpass
```

### 2. Create Credentials File

Create `.secrets/backup_credentials` with your SSH details:

```bash
cd /opt/hefaistos
nano .secrets/backup_credentials
```

Add these lines (replace with your actual values):
```bash
REMOTE_USER=backup-user
REMOTE_HOST=192.168.1.100
REMOTE_PORT=22
REMOTE_PASSWORD=YourSecurePasswordHere
REMOTE_PATH=/backups/hefaistos
```

**Secure the file:**
```bash
chmod 600 .secrets/backup_credentials
```

### 3. Create Remote Directory

Connect to your backup server and create the backup directory:

```bash
ssh backup-user@192.168.1.100
mkdir -p /backups/hefaistos
chmod 700 /backups/hefaistos
exit
```

### 4. Test the Backup

```bash
cd /opt/hefaistos/scripts
chmod +x backup-hefaistos.sh
./backup-hefaistos.sh
```

Check logs for success:
```bash
journalctl -t hefaistos-backup -n 50
```

## Configuration

The script automatically reads credentials from `.secrets/backup_credentials`. You can also adjust:

```bash
# In backup-hefaistos.sh
RETENTION_DAYS=30  # How many days to keep backups
```

## Running Backups

### Manual Execution
```bash
cd /opt/hefaistos/scripts
chmod +x backup-hefaistos.sh
./backup-hefaistos.sh
```

### Automated Daily Backups (Cron)

Since credentials are in `.secrets/backup_credentials`, cron jobs work without prompts:

```bash
crontab -e

# Add: Run daily at 2 AM
0 2 * * * /opt/hefaistos/scripts/backup-hefaistos.sh >> /var/log/hefaistos-backup.log 2>&1
```

The script will automatically read the password from the credentials file.

### Check Backup Logs
```bash
# View syslog entries
journalctl -t hefaistos-backup

# Or if using cron log
tail -f /var/log/hefaistos-backup.log
```

## What Gets Backed Up

The script creates a compressed archive containing:
- **Database**: PostgreSQL dump of Hefaistos database
- **Media Files**: Uploaded files and avatars
- **Secrets**: `.secrets` directory and connector tokens
- **Configuration**: `settings.py`, `docker-compose.yml`, `.env`
- **Elasticsearch**: Snapshots (if configured)

## Backup Structure

### Local (before upload):
```
/opt/hefaistos/backups/
├── 2025-12-31/
│   ├── db/hefaistos_db.sql
│   ├── media/...
│   ├── secrets/...
│   └── config/...
└── hefaistos-2025-12-31.tar.gz
```

### Remote (backup server):
```
/backups/hefaistos/
├── hefaistos-2025-12-01.tar.gz
├── hefaistos-2025-12-15.tar.gz
└── hefaistos-2025-12-31.tar.gz
```

## Restore from Backup

### 1. Download backup from remote
```bash
# Load credentials
source /opt/hefaistos/.secrets/backup_credentials

# Download using stored credentials
sshpass -p "$REMOTE_PASSWORD" scp -P $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/hefaistos-2025-12-31.tar.gz /opt/hefaistos/restore/
```

### 2. Extract archive
```bash
cd /opt/hefaistos/restore
tar -xzf hefaistos-2025-12-31.tar.gz
```

### 3. Restore database
```bash
cd /opt/hefaistos
docker compose exec -T db psql -U hefaistos_user -d hefaistos_db < restore/2025-12-31/db/hefaistos_db.sql
```

### 4. Restore media and secrets
```bash
cp -r restore/2025-12-31/media/* backend/media/
cp -r restore/2025-12-31/secrets/.secrets .secrets/
```

### 5. Restart services
```bash
docker compose restart
```

## Troubleshooting

### "sshpass: command not found"
```bash
# Install sshpass
sudo apt install sshpass  # Debian/Ubuntu
sudo yum install sshpass  # RHEL/CentOS
```

### "Credentials file not found"
```bash
# Create the credentials file
nano /opt/hefaistos/.secrets/backup_credentials

# Add required variables (see step 2 above)
# Then secure it:
chmod 600 /opt/hefaistos/.secrets/backup_credentials
```

### "SSH connection failed"
```bash
# Test connection manually with same credentials
source /opt/hefaistos/.secrets/backup_credentials
sshpass -p "$REMOTE_PASSWORD" ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}

# If this fails, check:
# - REMOTE_HOST is correct (IP or hostname)
# - REMOTE_PORT is correct (usually 22)
# - REMOTE_USER exists on backup server
# - REMOTE_PASSWORD is correct
# - Firewall allows SSH connection
```

### "Permission denied"
```bash
# On backup server, ensure directory exists and has correct permissions
ssh backup-user@192.168.1.100
mkdir -p /backups/hefaistos
chmod 700 /backups/hefaistos
ls -la /backups/
```

### Check if backup uploaded successfully
```bash
# Load credentials
source /opt/hefaistos/.secrets/backup_credentials

# List remote backups
sshpass -p "$REMOTE_PASSWORD" ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} "ls -lh ${REMOTE_PATH}/"
```

## Security Best Practices

1. **Secure credentials file**: Always set `chmod 600` on `.secrets/backup_credentials`
2. **Strong passwords**: Use complex passwords for SSH authentication
3. **Dedicated backup user**: Create a limited user on backup server just for backups
   ```bash
   # On backup server
   sudo useradd -m -s /bin/bash backup-user
   sudo passwd backup-user
   sudo mkdir -p /backups/hefaistos
   sudo chown backup-user:backup-user /backups/hefaistos
   sudo chmod 700 /backups/hefaistos
   ```
4. **Firewall rules**: Only allow SSH from your Hefaistos server IP
   ```bash
   # On backup server
   sudo ufw allow from 192.168.1.50 to any port 22
   ```
5. **Backup the .secrets folder**: Include `.secrets/backup_credentials` in your disaster recovery plan
6. **Monitor logs**: Regularly check backup logs via `journalctl -t hefaistos-backup`
7. **Test restores**: Periodically test restoring backups to ensure they work

## Monitoring

Check backup status:
```bash
# Load credentials first
source /opt/hefaistos/.secrets/backup_credentials

# List recent backups on remote
sshpass -p "$REMOTE_PASSWORD" ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} "ls -lh ${REMOTE_PATH}/ | tail -10"

# Check total backup size
sshpass -p "$REMOTE_PASSWORD" ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} "du -sh ${REMOTE_PATH}/"

# Verify latest backup exists
LATEST=$(date +%Y-%m-%d)
sshpass -p "$REMOTE_PASSWORD" ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} "ls -lh ${REMOTE_PATH}/hefaistos-${LATEST}.tar.gz"

# Check backup logs
journalctl -t hefaistos-backup -n 50

# Or if using cron log file
tail -50 /var/log/hefaistos-backup.log
```

## Support

For issues:
1. Check logs: `journalctl -t hefaistos-backup`
2. Test rclone manually: `rclone lsd backup-sftp: -vv`
3. Verify Docker services: `docker compose ps`
4. Check disk space: `df -h`
