# Security Implementation Summary: Admin & GraphQL IP Restriction

## Changes Made

### 1. Backend Middleware Update
**File**: `backend/core/middleware.py`

Extended `AdminIPRestrictionMiddleware` to protect both admin and GraphQL endpoints:
- Added `/graphql` path to restricted paths
- Added `/api/admin/` and `/api/graphql` alternative paths
- Updated docstring and log messages to reflect new scope
- Maintains backward compatibility with existing configuration

**Protected Paths**:
- `/admin` - Django admin panel
- `/graphql` - GraphQL API endpoint
- `/api/admin/` - Admin API paths
- `/api/graphql` - Alternative GraphQL path

### 2. Nginx Configuration Update
**File**: `nginx/conf.d/hefaistos.conf`

Added IP-based access control at the reverse proxy level:

#### GraphQL Endpoint (`/graphql`)
```nginx
location /graphql {
    allow 127.0.0.1;           # IPv4 localhost
    allow ::1;                 # IPv6 localhost
    allow 10.0.0.0/8;          # Class A private
    allow 172.16.0.0/12;       # Docker networks
    allow 192.168.0.0/16;      # Class C private
    deny all;                  # Block all others
    proxy_pass http://backend:8000/graphql;
    # ... proxy headers ...
}
```

#### Admin Panel (`/admin`)
```nginx
location /admin {
    allow 127.0.0.1;
    allow ::1;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;
    proxy_pass http://backend:8000/admin;
    # ... proxy headers ...
}
```

#### Admin Static Files (`/static/admin/`)
```nginx
location /static/admin/ {
    # Same allow rules as above
    deny all;
    proxy_pass http://backend:8000/static/admin/;
}
```

**Key Headers Added**:
- `X-Real-IP $remote_addr` - Passes actual client IP to backend for logging

### 3. Documentation
**File**: `Docs/ADMIN_GRAPHQL_IP_RESTRICTION.md`

Comprehensive guide covering:
- Overview of changes
- Default allowed networks
- Configuration instructions
- Customization guide
- How IP detection works
- Testing procedures
- Common IP ranges
- Security considerations
- Troubleshooting guide

## Security Architecture

### Two-Layer Defense

```
External Request (e.g., 203.0.113.50)
    ↓
Nginx Layer (FAST REJECT)
├─ Check IP against allow/deny rules
├─ If not allowed: return 403 immediately
└─ No backend processing required
    ↓
Django Middleware (BACKUP DEFENSE)
├─ Get client IP from headers
├─ Check against ADMIN_ALLOWED_IP_RANGES
├─ Log all attempts
└─ Reject if not allowed
    ↓
Endpoint Handler (Normal Processing)
```

### Benefits

1. **Performance**: Nginx rejects unauthorized requests before reaching Django
2. **Resource Efficiency**: Blocked connections use minimal backend resources
3. **Defense-in-Depth**: Two independent layers catch bypasses
4. **Logging**: All attempts logged for security monitoring
5. **Flexibility**: Easy to adjust allowed IP ranges

## Default Allowed Networks

| Network | Range | Purpose |
|---------|-------|---------|
| 127.0.0.1/32 | 127.0.0.1 | IPv4 Localhost |
| ::1/128 | ::1 | IPv6 Localhost |
| 10.0.0.0/8 | 10.0.0.0 - 10.255.255.255 | Private (Class A) |
| 172.16.0.0/12 | 172.16.0.0 - 172.31.255.255 | Docker Networks |
| 192.168.0.0/16 | 192.168.0.0 - 192.168.255.255 | Private (Class C) |

## Testing

### Test From Allowed Network
```bash
# From 192.168.x.x or 10.x.x.x
curl -k https://localhost:8443/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
# Expected: 200 OK with GraphQL response
```

### Test From Blocked Network
```bash
# From external IP
curl -k https://localhost:8443/graphql
# Expected: 403 Forbidden
```

## Configuration

### Update Allowed IP Ranges

#### Method 1: Nginx Only (Faster)
Edit `nginx/conf.d/hefaistos.conf` and add/remove `allow` directives:
```nginx
location /graphql {
    allow 203.0.113.0/24;  # Add your office network
    deny all;
}
```
Then: `docker-compose restart nginx`

#### Method 2: Django Only (More Flexible)
Edit `backend/core/settings.py`:
```python
ADMIN_ALLOWED_IP_RANGES = [
    '127.0.0.1',
    '::1',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '203.0.113.0/24',  # Add your network
]
```
Then: `docker-compose restart backend`

#### Method 3: Both (Recommended)
Update both for consistency and layered security.

## Logs to Monitor

### Nginx Access Logs
```
192.168.1.100 - - [date] "GET /graphql HTTP/1.1" 200
203.0.113.50 - - [date] "GET /admin HTTP/1.1" 403
```

### Django Backend Logs
```
INFO: Restricted path access attempt - IP: 192.168.1.100, Path: /graphql
INFO: Restricted access ALLOWED for IP: 192.168.1.100, Path: /graphql
WARNING: Restricted access DENIED for IP: 203.0.113.50, Path: /admin
```

View logs:
```bash
docker-compose logs -f nginx    # Nginx logs
docker-compose logs -f backend  # Django logs
```

## Verification Checklist

- [ ] Backend middleware updated with new path protections
- [ ] Nginx config updated with allow/deny rules for `/graphql` and `/admin`
- [ ] X-Real-IP header added to nginx proxy configuration
- [ ] Documentation created in `Docs/ADMIN_GRAPHQL_IP_RESTRICTION.md`
- [ ] Changes tested from allowed network (200 OK)
- [ ] Changes tested from blocked network (403 Forbidden)
- [ ] Logs reviewed for correct IP detection
- [ ] Default allowed ranges match your infrastructure

## Rollback

If issues occur, revert changes:

```bash
# Option 1: Git rollback (if not committed yet)
git checkout backend/core/middleware.py
git checkout nginx/conf.d/hefaistos.conf

# Option 2: Temporarily disable restrictions
# In nginx/conf.d/hefaistos.conf, comment out allow/deny rules
# In backend/core/settings.py, set ADMIN_ALLOWED_IP_RANGES = []

# Restart services
docker-compose restart nginx backend
```

## Next Steps

1. Verify implementation with tests from allowed/blocked networks
2. Monitor logs for 48 hours to identify any false positives
3. Adjust allowed IP ranges based on your infrastructure
4. Consider adding VPN access for remote admin needs
5. Document your network topology for future reference

## References

- [IP Restriction Guide](Docs/ADMIN_GRAPHQL_IP_RESTRICTION.md)
- [Installation Guide](Docs/INSTALLATION_GUIDE.md#network-configuration)
- [Nginx Access Module Docs](https://nginx.org/en/docs/http/ngx_http_access_module.html)
- [Django Middleware Docs](https://docs.djangoproject.com/en/5.2/topics/http/middleware/)
