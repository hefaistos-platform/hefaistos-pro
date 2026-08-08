# Compose Service Matrix

This matrix maps the current Compose services to the new default/profile behavior.

| Service | Role | Current behavior | Target behavior | Profile |
|---|---|---|---|---|
| nginx | edge | always-on | always-on core ingress | core |
| frontend | core | always-on | always-on core UI | core |
| backend | core | always-on | always-on core API | core |
| db | stateful | always-on | always-on core database | core |
| rabbitmq | stateful | always-on | always-on core broker | core |
| elasticsearch | stateful | always-on | optional search backend | obs |
| qdrant | stateful | always-on | optional vector backend | obs |
| listener | worker | always-on | optional async worker | workers |
| ai_generation_worker | worker | always-on | optional async worker | workers |
| opentide_enrichment_worker | worker | always-on | optional async worker | workers |
| mve_validation_worker | worker | always-on | optional async worker | workers |
| scheduler | worker | always-on | optional scheduler | workers |
| opentide-hef-publish-worker | worker | always-on | optional publishing worker | workers |
| opentide-hef-import-worker | worker | always-on | optional import worker | workers |
| deploy_connector | devtool | always-on | optional connector runtime | devtools |
| notification_connector | devtool | always-on | optional connector runtime | devtools |
| threat_intel_connector | devtool | always-on | optional connector runtime | devtools |
| rule_connector | devtool | always-on | optional connector runtime | devtools |
| git_push_connector | devtool | always-on | optional connector runtime | devtools |
| migrate *(new)* | one-shot | n/a | run-on-demand migration task | batch |
| seed *(new)* | one-shot | n/a | run-on-demand seed task | batch |

## Service count impact

- **Before**: 19 services started by default (`docker compose up -d`).
- **After (default core)**: 5 services started by default (`nginx`, `frontend`, `backend`, `db`, `rabbitmq`).
- **After (full long-running stack)**: 19 services with `--profile workers --profile obs --profile devtools`.
- **Batch one-shots**: `migrate` and `seed` run via `docker compose run --rm ...` and are not always-on.
