# Admin & GraphQL Restriction: Common Scenarios & Examples

## Scenario 1: Home Network Setup

### Situation
You're running Hefaistos on a home server and want to access it from:
- Your home network: 192.168.1.0/24
- Local machine: 127.0.0.1

### Configuration

**nginx/conf.d/hefaistos.conf**:
```nginx
location /graphql {
    allow 127.0.0.1;
    allow 192.168.1.0/24;    # Home network
    deny all;
    # ... rest of config ...
}

location /admin {
    allow 127.0.0.1;
    allow 192.168.1.0/24;    # Home network
    deny all;
    # ... rest of config ...
}
```

### Testing
```bash
# From home computer (192.168.1.100)
curl -k https://hefaistos.local:8443/graphql

# Should work (200 OK)
```

---

## Scenario 2: Corporate Network with VPN

### Situation
You need access from:
- Office network: 10.10.0.0/16
- VPN tunnel: 10.8.0.0/24 (OpenVPN)
- Localhost: 127.0.0.1

### Configuration

**nginx/conf.d/hefaistos.conf**:
```nginx
location /graphql {
    allow 127.0.0.1;
    allow 10.10.0.0/16;      # Office network
    allow 10.8.0.0/24;       # VPN tunnel
    allow 172.16.0.0/12;     # Docker networks
    deny all;
    # ... rest of config ...
}

location /admin {
    allow 127.0.0.1;
    allow 10.10.0.0/16;      # Office network
    allow 10.8.0.0/24;       # VPN tunnel
    allow 172.16.0.0/12;     # Docker networks
    deny all;
    # ... rest of config ...
}
```

### Testing
```bash
# From office (10.10.5.50)
curl -k https://hefaistos.local:8443/admin
# ✓ Works (200 OK)

# From VPN (10.8.10.100)
curl -k https://hefaistos.local:8443/graphql
# ✓ Works (200 OK)

# From external internet (203.0.113.50)
curl -k https://hefaistos.local:8443/admin
# ✗ Blocked (403 Forbidden)
```

---

## Scenario 3: Kubernetes/Container Cluster

### Situation
Hefaistos running in Kubernetes with:
- Pod network: 10.244.0.0/16
- Service network: 10.96.0.0/12
- Localhost: 127.0.0.1

### Configuration

**nginx/conf.d/hefaistos.conf**:
```nginx
location /graphql {
    allow 127.0.0.1;
    allow 10.244.0.0/16;     # Kubernetes pod network
    allow 10.96.0.0/12;      # Kubernetes service network
    deny all;
    # ... rest of config ...
}

location /admin {
    allow 127.0.0.1;
    allow 10.244.0.0/16;     # Kubernetes pod network
    allow 10.96.0.0/12;      # Kubernetes service network
    deny all;
    # ... rest of config ...
}
```

### Testing
```bash
# From pod in cluster (10.244.1.5)
kubectl exec -it hefaistos-backend-0 -- bash
curl http://hefaistos-frontend:80/graphql
# ✓ Works (200 OK)

# From external (203.0.113.50)
curl https://hefaistos.example.com/graphql
# ✗ Blocked (403 Forbidden)
```

---

## Scenario 4: Multiple Office Locations

### Situation
Organization with multiple office locations:
- Main office: 10.0.0.0/24
- Remote office 1: 10.1.0.0/24
- Remote office 2: 10.2.0.0/24
- All connected via private network

### Configuration

**nginx/conf.d/hefaistos.conf**:
```nginx
location /graphql {
    allow 127.0.0.1;
    allow 10.0.0.0/24;       # Main office
    allow 10.1.0.0/24;       # Remote office 1
    allow 10.2.0.0/24;       # Remote office 2
    allow 172.16.0.0/12;     # Docker networks
    deny all;
    # ... rest of config ...
}

location /admin {
    allow 127.0.0.1;
    allow 10.0.0.0/24;       # Main office
    allow 10.1.0.0/24;       # Remote office 1
    allow 10.2.0.0/24;       # Remote office 2
    allow 172.16.0.0/12;     # Docker networks
    deny all;
    # ... rest of config ...
}
```

**backend/core/settings.py** (as backup):
```python
ADMIN_ALLOWED_IP_RANGES = [
    '127.0.0.1',
    '10.0.0.0/24',           # Main office
    '10.1.0.0/24',           # Remote office 1
    '10.2.0.0/24',           # Remote office 2
    '172.16.0.0/12',         # Docker networks
]
```

### Testing
```bash
# From each office
for location in "Main (10.0.5.50)" "Remote1 (10.1.5.50)" "Remote2 (10.2.5.50)"; do
    echo "Testing from $location"
    curl -k https://hefaistos.local:8443/admin
    # All should work (200 OK)
done
```

---

## Scenario 5: Hybrid Cloud Setup

### Situation
Hefaistos in data center with multi-cloud connectivity:
- Data center: 192.168.10.0/24
- AWS VPC: 172.31.0.0/16
- Azure VNet: 10.0.0.0/16
- GCP VPC: 10.100.0.0/16

### Configuration

**nginx/conf.d/hefaistos.conf**:
```nginx
location /graphql {
    allow 127.0.0.1;
    allow 192.168.10.0/24;   # Data center
    allow 172.31.0.0/16;     # AWS VPC
    allow 10.0.0.0/16;       # Azure VNet
    allow 10.100.0.0/16;     # GCP VPC
    deny all;
    # ... rest of config ...
}

location /admin {
    allow 127.0.0.1;
    allow 192.168.10.0/24;   # Data center
    allow 172.31.0.0/16;     # AWS VPC
    allow 10.0.0.0/16;       # Azure VNet
    allow 10.100.0.0/16;     # GCP VPC
    deny all;
    # ... rest of config ...
}
```

### Deployment
```bash
# Update Nginx config
docker-compose restart nginx

# Verify restrictions
curl -k https://hefaistos.cloud/graphql  # From AWS
# ✓ Works (200 OK)

curl -k https://hefaistos.cloud/admin    # From Azure
# ✓ Works (200 OK)

curl -k https://hefaistos.cloud/admin    # From internet
# ✗ Blocked (403 Forbidden)
```

---

## Scenario 6: Development Environment

### Situation
Development setup with:
- Local docker-compose network: 172.17.0.0/16
- Local machine: 127.0.0.1
- CI/CD server: 192.168.1.50

### Configuration

**backend/core/settings.py**:
```python
ADMIN_ALLOWED_IP_RANGES = [
    '127.0.0.1',
    '192.168.1.50',          # CI/CD server
    '172.17.0.0/16',         # Docker compose network
]
```

**nginx/conf.d/hefaistos.conf** (permissive for dev):
```nginx
location /graphql {
    # In development, allow local ranges
    allow 127.0.0.1;
    allow 172.17.0.0/16;     # Docker network
    allow 192.168.1.0/24;    # Local network
    deny all;
    # ... rest of config ...
}
```

### Usage
```bash
# Start services
docker-compose up -d

# Test from local machine
curl -k https://localhost:8443/graphql
# ✓ Works (200 OK)

# Test from CI/CD
ssh ci-server "curl https://hefaistos.local:8443/admin"
# ✓ Works (200 OK)

# Test from internet (should fail)
curl https://hefaistos.example.com/graphql
# ✗ Blocked (403 Forbidden)
```

---

## Scenario 7: Emergency Admin Access

### Situation
Admin needs temporary external access for emergency maintenance

### Quick Fix (Temporary)

**Option 1: Add single IP to Nginx**
```nginx
location /admin {
    allow 127.0.0.1;
    allow 203.0.113.50;      # Emergency access (TEMPORARY!)
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;
    # ... rest of config ...
}
```
Then: `docker-compose restart nginx`

**Option 2: Temporarily disable restrictions**
```bash
# Edit nginx/conf.d/hefaistos.conf
# Comment out: allow/deny rules

# Edit backend/core/settings.py
ADMIN_ALLOWED_IP_RANGES = []  # Allow all (TEMPORARY!)

docker-compose restart nginx backend
```

### Important Notes
- ⚠️ **Temporary only** - Re-enable restrictions immediately after
- Document the change in a ticket/log
- Set a reminder to revert
- Monitor logs during emergency access
- Consider using VPN instead for regular remote access

### Re-enable Restrictions
```bash
# Revert the changes
git checkout nginx/conf.d/hefaistos.conf
git checkout backend/core/settings.py

# Restart
docker-compose restart nginx backend
```

---

## Scenario 8: Migration Between Networks

### Situation
Server moving from old network (192.168.1.0/24) to new network (10.0.0.0/24)

### Migration Steps

**Step 1: Add new network (coexist period)**
```nginx
location /admin {
    allow 127.0.0.1;
    allow 192.168.1.0/24;    # Old network (still active)
    allow 10.0.0.0/24;       # New network
    deny all;
}
```
```bash
docker-compose restart nginx
```

**Step 2: Verify both networks work**
```bash
# Test from old network
curl -k https://192.168.1.11:8443/admin
# ✓ Works (200 OK)

# Test from new network
curl -k https://10.0.1.11:8443/admin
# ✓ Works (200 OK)
```

**Step 3: Migrate services gradually**
- Update client applications to use new network IP
- Monitor logs for migration issues

**Step 4: Remove old network (after confirmation)**
```nginx
location /admin {
    allow 127.0.0.1;
    # Old network removed
    allow 10.0.0.0/24;       # New network only
    deny all;
}
```
```bash
docker-compose restart nginx
```

---

## Troubleshooting by Scenario

### "403 Forbidden" from expected network
```bash
# Verify your actual IP
curl https://ifconfig.me

# Check if it's in allowed range
# If not, verify network configuration

# Example troubleshooting
ip addr show              # Linux
ipconfig                 # Windows
ifconfig                 # macOS

# Check nginx logs
docker-compose logs nginx | grep "access denied"

# Check Django logs
docker-compose logs backend | grep "DENIED"
```

### Getting blocked after network change
```bash
# Verify your new IP is in ADMIN_ALLOWED_IP_RANGES
python3 -c "
import ipaddress
ip = ipaddress.ip_address('10.0.1.50')
network = ipaddress.ip_network('10.0.0.0/24')
print(f'{ip} in {network}: {ip in network}')
"

# If false, update ranges
```

### Different access from different machines
```bash
# All machines should have consistent behavior
# If not, check:
# 1. Are they on the same network?
# 2. Are they using different routes?
# 3. Is there a firewall blocking some?

# Debug IP detection
docker-compose exec backend python3 << 'EOF'
import ipaddress
# List all allowed networks
allowed = ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
for r in allowed:
    print(f"  {ipaddress.ip_network(r, strict=False)}")
EOF
```

---

## Summary Table

| Scenario | Key Networks | Use Case |
|----------|-------------|----------|
| Home | 127.0.0.1, 192.168.1.0/24 | Single home network |
| Corporate | 10.x.x.x/8 + VPN | Multi-office organization |
| Kubernetes | 10.244.0.0/16, 10.96.0.0/12 | Container orchestration |
| Multi-Office | Multiple /24 ranges | Distributed offices |
| Hybrid Cloud | Multiple cloud VPCs | Multi-cloud setup |
| Development | 172.17.0.0/16 | Local development |
| Emergency | + temporary IP | Short-term exceptions |
| Migration | Old + New networks | Network transition |

---

## Best Practices

1. **Start restrictive**: Begin with minimal allowed networks
2. **Add gradually**: Add new networks as needed
3. **Test thoroughly**: Verify each allowed network works
4. **Monitor logs**: Check for legitimate 403 errors
5. **Document changes**: Keep records of network configurations
6. **Use VPN**: For remote access instead of port forwarding
7. **Regular review**: Periodically audit allowed IP ranges
8. **Incident response**: Have process for temporary access grants
