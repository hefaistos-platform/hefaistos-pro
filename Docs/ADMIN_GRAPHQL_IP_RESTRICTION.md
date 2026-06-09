# Admin & GraphQL IP Restriction Configuration

## Overview

The `/admin` and `/graphql` endpoints are now restricted to private networks only to prevent unauthorized external access. This applies defense-in-depth security by filtering at both the nginx reverse proxy level and the Django middleware level.

## Default Allowed Networks

By default, the following networks are allowed to access restricted endpoints:

### IPv4 Private Ranges
- **127.0.0.1/32** - Localhost IPv4
- **10.0.0.0/8** - Class A Private (10.0.0.0 to 10.255.255.255)
- **172.16.0.0/12** - Class B Private (172.16.0.0 to 172.31.255.255)
- **192.168.0.0/16** - Class C Private (192.168.0.0 to 192.168.255.255)

### IPv6 Private Ranges
- **::1/128** - Localhost IPv6

## Restricted Endpoints

The following paths are protected by IP restrictions:

- `/admin` - Django admin panel
- `/admin/` - Django admin with trailing slash
- `/static/admin/` - Django admin static files (CSS, JS)
- `/graphql` - GraphQL API endpoint
- `/api/graphql` - Alternative GraphQL path
- `/api/admin/` - Admin API endpoints

## Configuration

### Django Backend (middleware.py)

The `AdminIPRestrictionMiddleware` provides a second layer of protection. Configure allowed IP ranges:

```python
# backend/core/settings.py
ADMIN_ALLOWED_IP_RANGES = [
    '127.0.0.1',
    '::1',
    '192.168.1.0/24',    # Your home network
    '10.0.0.0/8',        # Docker internal networks
    '172.16.0.0/12',     # Docker bridge networks
]
```

**Note:** Default ranges (shown above) are applied automatically if not configured.

### Nginx Reverse Proxy (nginx/conf.d/hefaistos.conf)

Nginx applies IP-based access control before requests reach Django:

```nginx
location /graphql {
    allow 127.0.0.1;
    allow ::1;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;
    
    proxy_pass http://backend:8000/graphql;
    # ... proxy headers ...
}

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

## Customizing Allowed Networks

To add additional networks or IP ranges:

### Option 1: Update Nginx Configuration

Edit `nginx/conf.d/hefaistos.conf` and add `allow` directives:

```nginx
location /graphql {
    allow 127.0.0.1;
    allow ::1;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    allow 203.0.113.0/24;  # Add your office network
    deny all;
    
    # ... rest of config ...
}
```

Then restart nginx:
```bash
docker-compose restart nginx
```

### Option 2: Update Django Configuration

Edit `backend/core/settings.py`:

```python
ADMIN_ALLOWED_IP_RANGES = [
    '127.0.0.1',
    '::1',
    '192.168.1.0/24',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '203.0.113.0/24',     # Add your office network
]
```

Then restart backend:
```bash
docker-compose restart backend
```

## How It Works

### Two-Layer Protection

1. **Nginx Layer (First)**: Drops connection before it reaches Django
   - Faster rejection
   - Lower resource usage
   - No backend processing

2. **Django Layer (Second)**: IP validation middleware
   - Defense-in-depth
   - Catches requests that bypass nginx
   - Provides detailed logging

### IP Detection

The middleware uses this priority order to detect client IP:

1. **X-Real-IP** header (set by nginx)
2. **X-Forwarded-For** header (proxy chain)
3. **REMOTE_ADDR** (direct connection)

This ensures correct IP identification even behind proxies.

### Logging

All access attempts are logged:

```
INFO: Restricted path access attempt - IP: 192.168.1.100, Path: /graphql
INFO: Restricted access ALLOWED for IP: 192.168.1.100, Path: /graphql
WARNING: Restricted access DENIED for IP: 203.0.113.50, Path: /admin
```

## Testing

### Test Allowed Access

From an allowed network (e.g., 192.168.1.x):

```bash
curl https://hefaistos.local:8443/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

**Expected**: 200 OK with GraphQL response

### Test Denied Access

From an external/public network:

```bash
curl https://hefaistos.local:8443/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

**Expected**: 403 Forbidden (nginx) or `<h1>403 Forbidden</h1>` (Django)

### Admin Panel Test

```bash
# From allowed network:
curl https://hefaistos.local:8443/admin/

# From external network:
curl https://hefaistos.local:8443/admin/
```

## Common IP Ranges

### Private Networks (RFC 1918)
- `10.0.0.0/8` - Large private networks (e.g., corporate)
- `172.16.0.0/12` - Docker bridge networks
- `192.168.0.0/16` - Small private networks (e.g., home)
- `127.0.0.0/8` - Loopback (localhost)
- `::1/128` - IPv6 localhost

### Docker Networks
- `172.17.0.0/16` - Default Docker bridge
- Container IPs: Usually `172.17.x.x` or `172.18.x.x`

### VPN/Tunnel Networks
- Add your VPN subnet (e.g., `10.8.0.0/24` for OpenVPN)

## Security Considerations

### Why Restrict These Endpoints?

- **`/admin`**: Django admin is intended for internal use only
  - Contains sensitive configuration and user management
  - Not rate-limited or optimized for external use
  - Should never be exposed to the internet

- **`/graphql`**: GraphQL endpoint exposes your API
  - Can be abused for reconnaissance
  - Subject to query complexity attacks
  - Should be restricted to trusted networks

### Best Practices

1. **Use VPN** for remote admin access instead of port forwarding
2. **Update regularly** - Keep nginx and Django updated
3. **Monitor logs** - Check for repeated 403 errors indicating probes
4. **Firewall rules** - Layer firewall rules for additional protection
5. **Change ports** - Use non-standard ports (already using 8443)

## Troubleshooting

### "403 Forbidden" from Allowed Network

**Cause**: IP detection issue or misconfiguration

**Solution**:
1. Check your actual IP: `curl https://ifconfig.me`
2. Verify it's in allowed range
3. Check nginx logs: `docker-compose logs nginx | grep "access denied"`
4. Check Django logs: `docker-compose logs backend | grep "DENIED"`

### Admin/GraphQL Still Accessible Externally

**Cause**: Nginx rules not applied or old config cached

**Solution**:
```bash
# Verify nginx config
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload

# Or restart nginx
docker-compose restart nginx
```

### Getting Blocked from VPN

**Cause**: VPN subnet not in allowed ranges

**Solution**:
1. Determine your VPN subnet (e.g., `10.8.0.0/24`)
2. Add to nginx and Django configs
3. Restart services

## Rollback

If you need to temporarily allow all access for debugging:

### Nginx (Quick Temporary Fix)

Edit `nginx/conf.d/hefaistos.conf`:

```nginx
location /graphql {
    # Comment out restrictions:
    # allow 127.0.0.1;
    # deny all;
    
    proxy_pass http://backend:8000/graphql;
    # ... rest ...
}
```

**Warning**: This is not recommended for production!

### Django (via Settings)

```python
# Temporarily empty to allow all
ADMIN_ALLOWED_IP_RANGES = []  # Don't do this in production!
```

## References

- [RFC 1918 - Private Internet Addresses](https://tools.ietf.org/html/rfc1918)
- [Nginx Access Module](https://nginx.org/en/docs/http/ngx_http_access_module.html)
- [Django Middleware](https://docs.djangoproject.com/en/5.2/topics/http/middleware/)
