# Hefaistos Backup Guide

This document explains how to set up, configure, and manage daily backups of the entire Hefaistos platform to Proton Drive using Rclone and a Bash script.

---

## Overview

The backup system backs up:

- **PostgreSQL Database** — complete `hefaistos_db` schema and data
- **Media Files** — uploaded files and attachments (`backend/media/`)
- **Secrets** — `.secrets/` directory and connector JWT token
- **Configuration** — key configuration files (`settings.py`, `docker-compose.yml`)
- **Elasticsearch Data** — indexed detection rules via snapshots
- **RabbitMQ** — optional (not typically needed; can be re-initialized)

All backups are compressed into a single `.tar.gz` archive and uploaded to Proton Drive, with automatic cleanup of backups older than 7 days.

---

## Prerequisites

### 1. Install Required Tools

```bash
# Update package manager
sudo apt-get update

# Install Docker and Docker Compose (if not already installed)
sudo apt-get install -y docker.io docker-compose

# Install Rclone
curl https://rclone.org/install.sh | sudo bash

# Verify installations
docker --version
docker-compose --version
rclone version
```

### 2. Configure Rclone for Proton Drive

```bash
# Launch Rclone configuration
rclone config
```

**Steps:**

1. Type `n` to create a new remote
2. Name it: `proton`
3. Choose storage type: Search for **Proton Drive** or select **FTP** if unavailable, then use direct HTTP API (Proton Drive has community support)
   - **Better approach:** Use `webdav` if Proton supports it, or use `sftp` if you have SFTP access
   - **Current recommendation:** Use Proton's official sync tool or check if Rclone supports Proton natively
4. Enter your Proton Drive credentials
5. Complete the configuration

**Alternative: Using `crypt` for client-side encryption** (optional, but Proton already encrypts):

Since you mentioned Proton encrypts by default, skip the `crypt` layer.

**Verify the remote:**

```bash
rclone listremotes
# Should output: proton:

rclone ls proton:
# Should list your Proton Drive contents
```

### 3. Verify Docker Compose Stack is Running

```bash
cd /path/to/hefaistos
docker-compose ps
# Ensure: db, backend, elasticsearch are all "Up"
```

---

## Script Setup

### 1. Make Script Executable

```bash
cd /path/to/hefaistos
chmod +x ./scripts/backup-hefaistos.sh
```

### 2. Verify Script Syntax

```bash
bash -n ./scripts/backup-hefaistos.sh
# Should produce no output if syntax is correct
```

### 3. Test the Script

Run a manual backup to verify everything works:

```bash
./scripts/backup-hefaistos.sh
```

**Expected output:**

```
[2025-12-29 02:00:00] [INFO] Hefaistos Backup Job Started
[2025-12-29 02:00:01] [INFO] Preflight checks passed
[2025-12-29 02:00:05] [INFO] Database backup completed successfully (245M)
[2025-12-29 02:00:15] [INFO] Media files backup completed (102M)
[2025-12-29 02:00:20] [INFO] Secrets directory backed up
[2025-12-29 02:00:25] [INFO] Configuration files backed up
[2025-12-29 02:00:30] [INFO] Elasticsearch snapshot created: hefaistos_2025_12_29
[2025-12-29 02:01:00] [INFO] Archive created successfully (350M)
[2025-12-29 02:02:00] [INFO] Upload to Proton Drive completed
[2025-12-29 02:02:05] [INFO] Backup verification passed
[2025-12-29 02:02:10] [INFO] Hefaistos Backup Job Completed Successfully
```

Logs are sent to **syslog** under the tag `hefaistos-backup`. View them:

```bash
sudo journalctl -t hefaistos-backup -f
# or
sudo tail -f /var/log/syslog | grep hefaistos-backup
```

---

## Schedule Automatic Daily Backups

### Option 1: Using Crontab (Recommended)

Edit your crontab:

```bash
crontab -e
```

Add the following line to run backups daily at **2:00 AM**:

```bash
0 2 * * * /path/to/hefaistos/scripts/backup-hefaistos.sh >> /var/log/hefaistos-backup.log 2>&1
```

**Breakdown:**

- `0 2 * * *` — Every day at 2:00 AM
- `/path/to/hefaistos/scripts/backup-hefaistos.sh` — Full path to the script
- `>> /var/log/hefaistos-backup.log 2>&1` — Log stdout and stderr to file

**Verify the cron job:**

```bash
crontab -l | grep backup-hefaistos
```

### Option 2: Using Systemd Timer (Alternative)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/hefaistos-backup.service
```

**Contents:**

```ini
[Unit]
Description=Hefaistos Daily Backup
After=docker.service
Wants=hefaistos-backup.timer

[Service]
Type=oneshot
ExecStart=/path/to/hefaistos/scripts/backup-hefaistos.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hefaistos-backup
User=root

[Install]
WantedBy=multi-user.target
```

Create a timer file:

```bash
sudo nano /etc/systemd/system/hefaistos-backup.timer
```

**Contents:**

```ini
[Unit]
Description=Hefaistos Daily Backup Timer
Requires=hefaistos-backup.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable hefaistos-backup.timer
sudo systemctl start hefaistos-backup.timer

# Check status
sudo systemctl status hefaistos-backup.timer
sudo journalctl -u hefaistos-backup.timer -f
```

---

## Monitoring & Troubleshooting

### View Backup Logs

**Real-time syslog:**

```bash
sudo journalctl -t hefaistos-backup -f
```

**View last backup:**

```bash
sudo journalctl -t hefaistos-backup -n 50
```

**Check local backup directory:**

```bash
ls -lh /path/to/hefaistos/backups/
# Lists all backup directories and archives
```

### Common Issues

**Issue: "Database container is not running"**

```bash
docker-compose up -d db backend elasticsearch
```

**Issue: "Rclone remote 'proton' not configured"**

```bash
rclone config
# Create or verify the 'proton' remote is set up correctly
```

**Issue: "Upload to Proton Drive failed"**

- Check internet connectivity: `ping proton.me`
- Verify Rclone remote: `rclone ls proton:`
- Check Proton Drive authentication: `rclone config reconnect proton`

**Issue: "Docker exec commands timeout"**

- Ensure containers are fully running: `docker-compose ps`
- Increase timeout or check Docker daemon: `sudo systemctl restart docker`

### List Backups on Proton Drive

```bash
rclone ls proton:hefaistos-backups
# or
rclone tree proton:hefaistos-backups
```

---

## Retention Policy

- **Local backups:** Kept for 7 days, then deleted
- **Remote backups on Proton Drive:** Kept for 7 days, then deleted
- **Modify retention:** Edit `RETENTION_DAYS=7` in `scripts/backup-hefaistos.sh`

**Manually delete old backups:**

```bash
# Local
find /path/to/hefaistos/backups -type d -name "20*" -mtime +7 -exec rm -rf {} \;

# Remote
rclone delete proton:hefaistos-backups --min-age 7d
```

---

## Restore Procedures

### Restore Database

1. **From local backup:**

```bash
cd /path/to/hefaistos
docker-compose exec -T db psql -U hefaistos_user -d hefaistos_db < ./backups/db/hefaistos_db.sql
```

2. **From Proton Drive backup:**

```bash
# Download specific backup
rclone copy proton:hefaistos-backups/2025-12-29 ./temp-restore/

# Extract
tar -xzf ./temp-restore/hefaistos-2025-12-29.tar.gz -C ./temp-restore/

# Restore
docker-compose exec -T db psql -U hefaistos_user -d hefaistos_db < ./temp-restore/2025-12-29/db/hefaistos_db.sql
```

### Restore Media Files

```bash
# Extract archive
tar -xzf ./backups/hefaistos-2025-12-29.tar.gz -C ./temp-restore/

# Copy media back
cp -r ./temp-restore/2025-12-29/media ./backend/
```

### Restore Secrets

```bash
# Extract archive
tar -xzf ./backups/hefaistos-2025-12-29.tar.gz -C ./temp-restore/

# Restore secrets
cp -r ./temp-restore/2025-12-29/secrets/.secrets ./.secrets

# Restart backend to apply
docker-compose restart backend
```

### Restore Elasticsearch Data

Elasticsearch snapshots are stored in the container volume. To restore:

```bash
# List available snapshots
docker-compose exec elasticsearch curl -X GET "localhost:9200/_snapshot/hefaistos_repo/_all"

# Restore a specific snapshot
docker-compose exec elasticsearch curl -X POST "localhost:9200/_snapshot/hefaistos_repo/hefaistos_2025_12_29/_restore"
```

---

## Backup File Structure

```
backups/
├── 2025-12-29/
│   ├── db/
│   │   └── hefaistos_db.sql          # PostgreSQL dump
│   ├── media/
│   │   └── [uploaded files]          # User-uploaded files
│   ├── secrets/
│   │   ├── .secrets/                 # .secrets directory
│   │   └── connector-token.jwt       # Connector service token
│   ├── config/
│   │   ├── settings.py               # Django settings
│   │   ├── docker-compose.yml        # Docker Compose config
│   │   └── .env                      # Environment variables (if exists)
│   └── elasticsearch/                 # Elasticsearch snapshots (container volume)
├── hefaistos-2025-12-29.tar.gz       # Compressed archive
└── hefaistos-2025-12-30.tar.gz       # Previous day's archive
```

---

## Security Considerations

1. **Proton Drive encryption:** All data is encrypted at rest and in transit by Proton
2. **Credentials:** Store Rclone config securely; run script as dedicated user if possible
3. **Secrets in backups:** `.secrets/` files are backed up; ensure Proton Drive account is secure
4. **Backup verification:** Script automatically verifies uploads to detect corruption
5. **Log retention:** Logs in syslog may retain sensitive information; manage accordingly

---

## Automation & High Availability

### Email Notifications (Optional)

Extend the script to send email alerts on failure:

```bash
# Add after error handler
if [ $? -ne 0 ]; then
  echo "Backup failed on $(date)" | mail -s "Hefaistos Backup Failure" your-email@example.com
fi
```

### Multiple Backup Targets

Modify the script to back up to multiple cloud providers:

```bash
# Add to upload_to_proton() function
rclone copy "$archive_file" "proton:hefaistos-backups/${BACKUP_DATE}" --progress
rclone copy "$archive_file" "gdrive:hefaistos-backups/${BACKUP_DATE}" --progress  # Additional target
```

### Backup Testing

Regularly test restore procedures:

```bash
# Monthly restore drill
chmod +x ./scripts/test-restore.sh
0 3 1 * * /path/to/hefaistos/scripts/test-restore.sh  # First day of month at 3 AM
```

---

## References

- [Rclone Documentation](https://rclone.org/docs/)
- [Proton Drive Sync Options](https://proton.me/support/)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Elasticsearch Snapshots](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-snapshots.html)
- [Crontab Format](https://crontab.guru/)
- [Systemd Timers](https://wiki.archlinux.org/title/Systemd/Timers)

---

## Support

For issues or improvements:

1. Check logs: `sudo journalctl -t hefaistos-backup -f`
2. Run manual test: `./scripts/backup-hefaistos.sh`
3. Verify Docker stack: `docker-compose ps`
4. Test Rclone: `rclone ls proton:`

