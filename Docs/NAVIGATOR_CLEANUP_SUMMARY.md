# MITRE Navigator Cleanup Summary

## Overview
Removed legacy local MITRE Navigator references from the platform. The system now exclusively uses the external MITRE Navigator at https://mitre-attack.github.io/attack-navigator/enterprise/.

## Changes Made

### 1. Documentation Reorganization
**Moved:**
- `ATTACK_NAVIGATOR_SETUP.md` → `Docs/ATTACK_NAVIGATOR_SETUP.md`
- Original file replaced with redirect notice at root for backward compatibility

**Purpose:** Legacy setup guide preserved for future reference if local Navigator deployment becomes necessary.

### 2. Fallback Structure Created
**Created:**
- `/fallback/` directory with README
- `/fallback/navigator/` subdirectory (empty, ready for future local bundle)

**Purpose:** Fallback assets directory for restoring local Navigator instance if needed in future versions.

### 3. Removed Local Navigator References

#### Nginx Configuration
**File:** `/nginx/conf.d/hefaistos.conf`

**Removed:**
```nginx
# REMOVED: /navigator/ proxy location block
location /navigator/ {
    proxy_pass http://host.docker.internal:4200/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Reason:** Platform uses external iframe URL, local proxy no longer needed.

#### Frontend Coverage Map Component
**File:** `/frontend/src/pages/CoverageMapPage.tsx`

**Changes:**
- Removed GraphQL import and `COVERAGE_LAYER_QUERY`
- Removed unused `gqlError` state handling
- Removed `layerJsonBlobUrl` blob URL logic
- Removed GraphQL client calls
- Simplified to REST-only layer URL fetching

**Result:** Component now directly embeds external MITRE Navigator iframe with REST API layer fetching.

#### Frontend Documentation
**File:** `/frontend/README.md`

**Changes:**
- Removed D3FEND toggle documentation references
- Simplified Navigator setup section
- Updated to reference `Docs/ATTACK_NAVIGATOR_SETUP.md` as fallback resource

### 4. Files Not Deleted (For Reference)
- `/frontend/public/navigator/` - Previously bundled local Navigator (placeholder)
- `/docker-compose.yml` - Navigator service removed, no changes needed to other services
- Backend GraphQL attack_navigator_layer resolver - Kept for backward compatibility

## Directory Structure
```
/Docs/
  ATTACK_NAVIGATOR_SETUP.md       ← Legacy setup guide (preserved)

/fallback/
  README.md                        ← Fallback directory guide
  navigator/                       ← Empty, ready for future local bundle
```

## Active Navigator URLs
- **External Navigator:** https://mitre-attack.github.io/attack-navigator/enterprise/
- **API Endpoint:** `/api/coverage/layers/` - Serves attack layer JSON to Navigator
- **CORS Enabled:** For mitre-attack.github.io domain

## Backward Compatibility
All changes maintain backward compatibility:
- Existing API endpoints continue working
- External Navigator URL remains functional
- Legacy documentation preserved for reference
- No database changes required

## Testing Recommendations
1. Verify Coverage Map page loads Navigator iframe correctly
2. Test layer JSON export from coverage/layers endpoint
3. Confirm layer data displays in external Navigator
4. Test on various browsers (Chrome, Firefox, Safari, Edge)

## Future Restoration
To restore local Navigator deployment in future:
1. Copy Navigator bundle to `/fallback/navigator/`
2. Refer to `Docs/ATTACK_NAVIGATOR_SETUP.md` for setup instructions
3. Re-enable nginx `/navigator/` proxy location
4. Update `frontend/README.md` with local setup steps
