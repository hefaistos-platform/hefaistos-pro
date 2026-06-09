# ATT&CK v19 Migration Guide

This document guides you through upgrading an existing HEFAISTOS installation that
loaded ATT&CK **v18.1** data to the new **v19.0** release.

---

## What changed in this release

| Area | Change |
|---|---|
| `MitreAttackTechnique` model | New fields: `tactic` (str), `revoked` (bool), `deprecated` (bool) |
| `PlatformDataVersion` model | New model that tracks the version loaded per framework |
| `import_mitre_universal` command | Default version bumped to `19.0`; imports `tactic`, `revoked`, `deprecated` columns; validates expected column headers; reports revoked/deprecated counts |
| `import_d3fend` command | Records a `PlatformDataVersion` entry after a successful import |
| Coverage-map layer | Excludes revoked/deprecated techniques; includes full v19 platform list |
| `search_techniques` GraphQL query | Hides revoked/deprecated techniques by default (`include_revoked` flag available) |
| `loaded_attack_versions` GraphQL query | New – returns the framework versions currently in the database |
| Admin UI | `tactic`, `revoked`, `deprecated` visible and filterable on the Technique list |

---

## Step-by-step upgrade for existing installations

### 1. Pull the latest code

```bash
cd /opt/hefaistos          # adjust to your install path
git pull
```

### 2. Apply the database migration

The new migration adds three columns to `MitreAttackTechnique` and creates the
`PlatformDataVersion` table.  It is **non-destructive** — no existing data is
altered.

```bash
docker compose exec backend python manage.py migrate
```

Expected output:
```
Running migrations:
  Applying platform_data.0010_attack_v19_fields... OK
```

### 3. Re-import ATT&CK data at v19.0

```bash
docker compose exec backend python manage.py import_mitre_universal \
    --mitre-version 19.0 --mode remote
```

The command uses `update_or_create`, so it is safe to run on a live database.
Existing playbook links are preserved.  After the import you will see a summary
like:

```
--- Processing enterprise-attack ---
Importing Techniques...
 - Imported 743 techniques (12 revoked, 3 deprecated).
Importing Detection Strategies...
 - Imported 302 Strategies.
...
Universal Import Complete.
```

#### Offline / air-gapped installations

1. Download the v19 Excel files from https://attack.mitre.org/resources/attack-data-and-tools/
   and copy them to the server:
   - `enterprise-attack-v19.0.xlsx`
   - `ics-attack-v19.0.xlsx`
   - `mobile-attack-v19.0.xlsx`

2. Place the files in a directory accessible to the backend container, e.g. `./data/mitre/`.

3. Run:

```bash
docker compose exec backend python manage.py import_mitre_universal \
    --mitre-version 19.0 --mode local --dir /app/data/mitre
```

### 4. (Optional) Refresh D3FEND mappings

New ATT&CK v19 techniques receive D3FEND countermeasure mappings when you
re-import D3FEND:

```bash
docker compose exec backend python manage.py import_d3fend
```

### 5. Verify the import

```bash
docker compose exec backend python manage.py shell << 'EOF'
from platform_data.models import MitreAttackTechnique, MitreDomain, PlatformDataVersion

for domain in [MitreDomain.ENTERPRISE, MitreDomain.ICS, MitreDomain.MOBILE]:
    total    = MitreAttackTechnique.objects.filter(domain=domain).count()
    revoked  = MitreAttackTechnique.objects.filter(domain=domain, revoked=True).count()
    deprecated = MitreAttackTechnique.objects.filter(domain=domain, deprecated=True).count()
    active   = total - revoked - deprecated
    print(f"{domain}: {total} total  |  {active} active  |  {revoked} revoked  |  {deprecated} deprecated")

print()
for v in PlatformDataVersion.objects.all():
    print(f"Loaded: {v.framework} v{v.version}  (imported {v.imported_at.strftime('%Y-%m-%d %H:%M UTC')})")
EOF
```

Example output:

```
enterprise-attack: 743 total  |  728 active  |  12 revoked  |  3 deprecated
ics-attack: 90 total  |  89 active  |  1 revoked  |  0 deprecated
mobile-attack: 76 total  |  76 active  |  0 revoked  |  0 deprecated

Loaded: enterprise-attack v19.0  (imported 2026-05-02 15:30 UTC)
Loaded: ics-attack v19.0  (imported 2026-05-02 15:30 UTC)
Loaded: mobile-attack v19.0  (imported 2026-05-02 15:31 UTC)
```

You can also check the loaded version via GraphQL:

```graphql
query {
  loadedAttackVersions {
    framework
    version
    importedAt
  }
}
```

### 6. Review playbooks that reference revoked techniques

Playbooks whose primary MITRE technique was revoked in v19 will still function
but should be re-mapped to the replacement technique.  Use the following query to
identify them:

```bash
docker compose exec backend python manage.py shell << 'EOF'
from playbooks.models import PlaybookGraph

stale = PlaybookGraph.objects.filter(
    mitre_technique__revoked=True
).select_related('mitre_technique', 'organization')

if not stale.exists():
    print("No playbooks reference revoked techniques.")
else:
    print(f"Found {stale.count()} playbook(s) referencing revoked techniques:\n")
    for pg in stale:
        tech = pg.mitre_technique
        print(f"  [{pg.organization.name}] {pg.title} → {tech.technique_id} ({tech.name}) — REVOKED")
    print("\nPlease re-map these playbooks to the current replacement techniques.")
EOF
```

---

## Rollback procedure

If you need to revert to v18.1 data:

1. Restore your pre-migration database backup **or** roll back the migration:

```bash
# Rollback migration (safe – only removes new columns and PlatformDataVersion table)
docker compose exec backend python manage.py migrate platform_data 0009
```

2. Re-import v18.1 data:

```bash
docker compose exec backend python manage.py import_mitre_universal \
    --mitre-version 18.1 --mode remote
```

---

## Frequently asked questions

**Q: Will re-running the import break existing playbooks?**  
A: No. The importer uses `update_or_create` on the primary key `(technique_id, domain)`.
Existing `PlaybookGraph.mitre_technique` FK references are unchanged.  Techniques
that are new in v19 are simply added.

**Q: What happens to playbooks that reference a technique revoked in v19?**  
A: The technique record is updated with `revoked=True` but is NOT deleted.  The
playbook FK remains valid.  The Coverage Map now excludes revoked techniques from
the Navigator layer.  Use the diagnostic query above to find and re-map affected
playbooks.

**Q: The importer printed "Missing expected columns" warnings. Is that a problem?**  
A: Not necessarily.  MITRE occasionally renames columns between releases.  The
importer will continue and skip the missing values.  Check the output counts to
verify that a reasonable number of techniques were imported.  If the count is 0 or
very low, inspect the actual column names in the downloaded Excel file and open a
bug report.

**Q: How do I check which version is loaded without a shell?**  
A: The GraphQL query `loadedAttackVersions` returns the current version and import
timestamp for each domain.  The Coverage Map layer description also includes the
version string.
