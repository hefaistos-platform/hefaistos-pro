# Quick Reference: Admin & GraphQL IP Restriction

## What Changed?

✅ `/admin` endpoint - Now restricted to private networks only  
✅ `/graphql` endpoint - Now restricted to private networks only  
✅ `/static/admin/` - Now restricted to private networks only  

## Allowed Networks (Default)

```
✓ 127.0.0.1 (localhost)
✓ ::1 (localhost IPv6)
✓ 10.0.0.0/8 (private Class A)
✓ 172.16.0.0/12 (Docker networks)
✓ 192.168.0.0/16 (private Class C)
✗ All other IPs → 403 Forbidden
```

## Test It

### Should Work (from allowed network)
```bash
curl -k https://localhost:8443/graphql
# → 200 OK

curl -k https://192.168.1.100:8443/admin
# → 200 OK or 302 (login redirect)
```

### Should Fail (from blocked network)
```bash
curl -k https://203.0.113.50:8443/graphql
# → 403 Forbidden

curl -k https://203.0.113.50:8443/admin
# → 403 Forbidden
```

## Add Your Network

### Option A: Nginx (Faster)
```nginx
# In nginx/conf.d/hefaistos.conf
location /graphql {
    allow 203.0.113.0/24;  # ← Add your network
    deny all;
    # ...
}

location /admin {
    allow 203.0.113.0/24;  # ← Add your network
    deny all;
    # ...
}
```
Then: `docker-compose restart nginx`

### Option B: `.env` (More Flexible)
```bash
# In .env
ADMIN_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,203.0.113.0/24
```
Then: `docker-compose restart backend`

## Common Networks

| Type | CIDR | Example |
|------|------|---------|
| Localhost | 127.0.0.1/32 | Your machine |
| Home | 192.168.1.0/24 | Router-based |
| Office | 10.x.x.0/24 | Corporate |
| VPN | 10.8.0.0/24 | OpenVPN |
| Docker | 172.16.0.0/12 | Containers |
| Kubernetes | 10.244.0.0/16 | K8s pods |

## Check Logs

### Nginx
```bash
docker-compose logs nginx | grep "access denied"
```

### Django
```bash
docker-compose logs backend | grep "Restricted"
```

## Verify Configuration

### Nginx syntax
```bash
docker-compose exec nginx nginx -t
```

### Django networks
```bash
docker-compose logs backend | grep "Configured networks"
```

## Emergency: Temporarily Disable

⚠️ **Only for debugging/emergency!**

```bash
# Option 1: Comment out restrictions in nginx
# Edit nginx/conf.d/hefaistos.conf
# Comment: allow/deny lines

# Option 2: Clear Django restrictions via .env
# In .env:
# ADMIN_ALLOWED_IP_RANGES=0.0.0.0/0

# Restart
docker-compose restart nginx backend

# REMEMBER: Re-enable afterwards!
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Can't access from new network | Add network to allowed ranges |
| Getting 403 from office | Check your office IP range |
| Works locally but not remote | VPN network not in list |
| Changed network, now blocked | Update both nginx and Django |
| Docker containers can't access | Add 172.16.0.0/12 or 10.0.0.0/8 |

## Files Modified

1. `backend/core/middleware.py` - Added /graphql protection
2. `nginx/conf.d/hefaistos.conf` - Added IP filtering

## Learn More

- **Full guide**: `Docs/ADMIN_GRAPHQL_IP_RESTRICTION.md`
- **Examples**: `Docs/ADMIN_GRAPHQL_SCENARIOS.md`
- **Details**: `Docs/IP_RESTRICTION_CHANGE_SUMMARY.md`

## Two-Layer Security

```
Request
  ↓
[Layer 1: Nginx] ← Fast rejection (0.1ms)
  ↓ (if allowed)
[Layer 2: Django] ← Backup check (1-5ms)
  ↓ (if allowed)
[Application]
```

## Default Behavior

- ✅ Private networks → Access granted
- ❌ Public internet → Access denied
- ✅ Logged for audit
- ✅ Fast rejection (no backend processing)

## Your Action Items

1. [ ] Review your network topology
2. [ ] Identify IP ranges needing access
3. [ ] Update config (nginx and/or Django)
4. [ ] Test from allowed network (should work)
5. [ ] Test from other network (should fail)
6. [ ] Monitor logs for 24 hours
7. [ ] Adjust if false positives found
8. [ ] Document your configuration

## Supported Scenarios

- Home networks (192.168.1.0/24)
- Corporate networks (10.x.x.0/24)
- Multi-office setups (multiple ranges)
- VPN tunnels (10.8.0.0/24)
- Docker/Kubernetes (172.16.0.0/12, 10.0.0.0/8)
- Hybrid cloud (AWS, Azure, GCP)
- Emergency temporary access

---

**Questions?** Check `Docs/ADMIN_GRAPHQL_SCENARIOS.md` for your specific setup.
