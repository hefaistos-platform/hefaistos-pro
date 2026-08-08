# Migrating an Existing HEFAISTOS Install (up to 1.5.3)

This guide explains how to migrate an **existing** HEFAISTOS deployment to the
current release. Starting with the profile-based Compose refactor, a plain
`git pull` followed by `docker compose up -d` is **not sufficient** — the default
startup now brings up only the core services, and several previously always-on
services (async workers, search/vector backends, connectors) are now gated behind
Compose profiles. There are also one-time steps (image rebuild, database
migrations run as a batch task, search index rebuild) that must be performed
explicitly.

> **Who is this for?** Operators upgrading a running instance from any version up
> to and including **1.5.3**. For a brand-new clean deployment, use
> [INSTALL_MANUAL.md](INSTALL_MANUAL.md) instead.

---

## What changed and why `git pull` + `docker compose up` is not enough

| Area | Before | After |
|---|---|---|
| Default `docker compose up -d` | Started **all 19 services** | Starts only **5 core services** (`nginx`, `frontend`, `backend`, `db`, `rabbitmq`) |
| Async workers / scheduler | Always-on | Behind the `workers` profile |
| Elasticsearch / Qdrant | Always-on | Behind the `obs` profile |
| Connectors (deploy, notification, threat_intel, rule, git_push) | Always-on | Behind the `devtools` profile |
| Migrations | `docker compose exec backend python manage.py migrate` | Run as a one-shot `batch` task via `make migrate` |
| Seeding | n/a | One-shot `batch` task via `make seed` |

Because of this, an existing install that simply runs `docker compose up -d` will
silently **not** start its workers, search, or connectors, and background
processing (enrichment, publishing/import, AI generation, scheduling) and search
will appear "broken." This guide walks through the full, safe migration.

See [compose-service-matrix.md](../docs/compose-service-matrix.md) for the complete
service → profile mapping.

---

## 0. Prerequisites

- Docker Engine + Docker Compose plugin (`docker compose version` must work)
- `git`, `openssl`, and Python 3 available on the host
- Enough free disk for a full backup of your Docker volumes
- A maintenance window — the app will be briefly unavailable during the upgrade

---

## 1. Announce a maintenance window and record current state

```bash
# From your existing deployment directory
docker compose ps > /tmp/hef_services_before.txt
git rev-parse HEAD > /tmp/hef_commit_before.txt
cat VERSION 2>/dev/null || true
```

Keep `/tmp/hef_services_before.txt` — it lists which services you were running so
you can enable the matching profiles after the upgrade.

---

## 2. Back up your data (required)

**Do not skip this.** The upgrade involves a database migration and (for older
installs) a PostgreSQL volume/mount change that cannot be trivially reverted.

If you have the bundled backup helper, use it:

```bash
./scripts/backup-hefaistos.sh
```

Otherwise, take a manual database dump and snapshot the named volumes:

```bash
# Ensure the database is up (db is a core service)
docker compose up -d db

# SQL dump
docker compose exec -T db pg_dump -U "${DB_USER:-hefaistos_user}" \
  "${DB_NAME:-hefaistos_db}" > /tmp/hefaistos_db_$(date +%Y%m%d_%H%M%S).sql

# List volumes to snapshot at the storage layer (db, rabbitmq, search, media, ...)
docker volume ls | grep -E 'postgres|rabbitmq|elasticsearch|qdrant|media|static|navigator'
```

Verify the dump is non-empty before continuing.

---

## 3. Stop the running stack (without deleting data)

```bash
docker compose down
```

> ⚠️ **Never** use `docker compose down -v` on an existing install you intend to
> keep — the `-v` flag **permanently deletes your volumes** (database, queues,
> search, media). `-v` is only appropriate for the destructive SHARP *clean*
> bootstrap, not for migration.

---

## 4. Update the code

```bash
git fetch --all
git pull            # or: git checkout <target-branch> && git pull
git log -1 --oneline
```

---

## 5. Reconcile `.env`, secrets, and overrides

New releases may introduce new environment variables, secrets, or Compose keys.

```bash
# Compare your live .env against the shipped template
diff -u .env .env.template || true

# Ensure the docker-compose override exists (if you use one)
[ -f docker-compose.override.yml ] || cp docker-compose.override.yml.template docker-compose.override.yml
```

Confirm all required secret files exist (create any that are missing):

```bash
ls -1 .secrets/
# Expected core secrets:
#   db_password, rabbitmq_pass, field_key, mailgun_api
# Optional (only if using the threat intel connector): misp_key
```

If a secret is missing, create it — but **never regenerate `field_key` on an
existing database**. `field_key` is the Fernet key used for field-level
encryption; changing it will make previously encrypted data unreadable. Reuse
your existing key.

Remove any variables that were dropped in earlier upgrades (for example the
retired `LSP_SIGMA_*` / `SIGCONVERTER_*` variables).

---

## 6. Rebuild images with the current pins

```bash
docker compose build --pull
```

---

## 7. Start the core stack

```bash
make up
# equivalent to: docker compose up -d
docker compose ps
```

This brings up `nginx`, `frontend`, `backend`, `db`, and `rabbitmq`.

### PostgreSQL 18 mount/volume note (older installs)

Current releases mount PostgreSQL data at `/var/lib/postgresql` (the PostgreSQL
18+ layout), **not** `/var/lib/postgresql/data`, and use the `postgres_data_v18`
volume. If `docker compose logs -f db` shows an
`unused mount/volume ... /var/lib/postgresql/data` error, your database is still
on the old layout. Follow the PostgreSQL 18 recovery procedure in
[INSTALL_MANUAL.md](INSTALL_MANUAL.md) §12 — restore your dump from step 2 into a
fresh `postgres_data_v18` volume rather than pointing the new image at the old
volume.

---

## 8. Apply database migrations

Migrations now run as a one-shot `batch` task:

```bash
make migrate
# equivalent to: docker compose --profile batch run --rm migrate
```

---

## 9. Enable the profiles you actually use

Re-enable the service groups you were running before (cross-reference
`/tmp/hef_services_before.txt` from step 1):

```bash
# Async workers + scheduler (enrichment, publish/import, AI generation, MVE, listener)
make up-workers

# Search + vector backends (Elasticsearch, Qdrant)
make up-obs

# Connectors (deploy, notification, threat_intel, rule, git_push)
make up-devtools
```

To bring up the entire previously-always-on stack in one command:

```bash
make up-full
# equivalent to:
# docker compose --profile workers --profile obs --profile devtools up -d
```

---

## 10. Rebuild search and refresh Navigator config

Required only if you use the search/vector features (`obs` profile). Run these
**after** `make up-obs` (or `make up-full`) so Elasticsearch is available:

```bash
docker compose exec backend python manage.py search_index --rebuild -f
docker compose exec backend python manage.py sync_navigator_config
```

---

## 11. Verify the migration

```bash
docker compose ps

# GraphQL reachability
docker compose exec backend curl -fsS \
  -H 'Content-Type: application/json' \
  -d '{"query":"{__typename}"}' \
  http://localhost:8000/graphql

# RabbitMQ health (core)
docker compose exec rabbitmq rabbitmq-diagnostics -q ping

# Elasticsearch health (only if obs profile is enabled)
docker compose exec elasticsearch curl -fsS http://localhost:9200

# Workers running (only if workers profile is enabled)
docker compose ps listener ai_generation_worker opentide_enrichment_worker mve_validation_worker scheduler
```

Then confirm in the UI:

1. Login (JWT issue + refresh) works.
2. GraphQL queries/mutations and file upload work.
3. Search returns results.
4. Background jobs (enrichment/publish/import) are processed.

---

## 12. Environment reload after `.env` changes

When you later change `.env` values, restart the affected services. The workers
restart is now profile-aware:

```bash
docker compose --profile workers up -d --force-recreate \
  backend scheduler opentide-hef-publish-worker opentide-hef-import-worker \
  listener ai_generation_worker opentide_enrichment_worker
```

---

## 13. Rollback

If the upgrade fails and you must revert:

1. `docker compose down` (again, **without** `-v`).
2. `git checkout $(cat /tmp/hef_commit_before.txt)`.
3. Restore the database dump / volume snapshot from step 2.
4. `docker compose build --pull && docker compose up -d --profile workers --profile obs --profile devtools`
   (the previous release started everything by default; `make up-full` reproduces
   that behavior on the current code if you only need the service set restored).

Because the profile refactor is startup-only (no schema change of its own),
reverting the code and re-enabling all profiles restores the prior behavior. Any
release-specific data migrations you applied in step 8 are reverted by restoring
the pre-upgrade database backup.

---

## Quick reference

```bash
docker compose down                 # stop, keep data (never use -v here)
git pull                            # update code
docker compose build --pull         # rebuild images
make up                             # start core (nginx, frontend, backend, db, rabbitmq)
make migrate                        # run DB migrations (batch one-shot)
make up-workers                     # enable async workers/scheduler
make up-obs                         # enable Elasticsearch/Qdrant
make up-devtools                    # enable connectors
make up-full                        # enable all profiles at once
```
