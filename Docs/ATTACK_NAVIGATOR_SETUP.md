# MITRE ATT&CK Navigator: Local Setup Guide

This project previously pulled the `mitre/attack-navigator` Docker image in `docker-compose.yml`. That image is no longer available, so the service has been removed. Use one of the official methods below to run the Navigator locally.

## Option A: Run via Angular dev server (recommended for development)

1. Clone the Navigator repository:
   ```bash
   git clone https://github.com/mitre-attack/attack-navigator.git
   cd attack-navigator/nav-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   ng serve
   ```
4. Open `http://localhost:4200` in your browser.

To produce a distributable build:
```bash
ng build --configuration production --aot=false --build-optimizer=false
```
Copy build artifacts from `nav-app/dist/` as needed.

## Option B: Run via Docker (build locally)

1. Navigate to the directory where you checked out the Navigator git repository.
2. Build the image:
   ```bash
   docker build -t attack-navigator .
   ```
3. Run the container:
   ```bash
   docker run -p 4200:4200 attack-navigator
   ```
4. Open `http://localhost:4200` in your browser.

## Using offline ATT&CK data (local files)

You can run the Navigator offline by hosting STIX bundle files locally and pointing the app configuration to them.

1. Place STIX bundle(s) (e.g., Enterprise, Mobile, ICS) in `nav-app/src/assets/`.
2. Edit `nav-app/src/assets/config.json` to enable local versions and reference your bundle(s), for example:
   ```json
   {
     "versions": {
       "enabled": true,
       "entries": [
         {
           "name": "Local Enterprise STIX Data",
           "version": "14",
           "domains": [
             {
               "name": "Enterprise",
               "identifier": "enterprise-attack",
               "data": ["assets/enterprise-attack.json"]
             }
           ]
         }
       ]
     }
   }
   ```

Alternatively, set `collection_index_url` to the official ATT&CK Collection Index to pull hosted content.

## Loading default layers at startup

To auto-load layers when the app starts:

1. In `nav-app/src/assets/config.json`, set `default_layers.enabled` to `true`.
2. Add local or remote JSON layer URLs to `default_layers.urls`, e.g.:
   ```json
   {
     "default_layers": {
       "enabled": true,
       "urls": [
         "assets/example.json",
         "https://raw.githubusercontent.com/mitre-attack/attack-navigator/master/layers/samples/Bear_APT.json"
       ]
     }
   }
   ```

## Custom context menu entries

Add custom options under `custom_context_menu_options` in `nav-app/src/assets/config.json`. Example:
```json
{
  "label": "view technique on ATT&CK website",
  "url": "https://attack.mitre.org/techniques/{{technique_attackID}}",
  "subtechnique_url": "https://attack.mitre.org/techniques/{{parent_technique_attackID}}/{{subtechnique_attackID_suffix}}"
}
```
Supported substitutions include (non-exhaustive):
- `{{technique_attackID}}`, `{{technique_stixID}}`, `{{technique_name}}`
- `{{subtechnique_attackID}}`, `{{subtechnique_stixID}}`, `{{subtechnique_name}}`, `{{subtechnique_attackID_suffix}}`
- `{{parent_technique_attackID}}`, `{{parent_technique_stixID}}`, `{{parent_technique_name}}`
- `{{tactic_attackID}}`, `{{tactic_stixID}}`, `{{tactic_name}}`

## TAXII 2.0 / 2.1 servers

To load content from a TAXII server, define `taxii_url` and `taxii_collection` per entry in `versions.entries[].domains[]`. TAXII 2.0 support will be deprecated in Dec 2024; prefer TAXII 2.1.

## Embedding or accessing layers from Hefaistos

- Backend layer endpoint: the coverage layer JSON is served at `GET /api/coverage/layer.json` defined in `backend/core/urls.py`.
- You can open the Navigator and load that layer URL via the "Open Layer from URL" option, or by using the URL fragment `#layerURL=...`.
- Example embed (adjust origin/paths as needed):
  ```html
  <iframe src="http://localhost:4200/enterprise/#layerURL=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fcoverage%2Flayer.json" width="1000" height="500"></iframe>
  ```

## Notes for Nginx / reverse proxy

`docker-compose.yml` no longer depends on a `mitre-navigator` container. If the Nginx config previously proxied to the `mitre-navigator` upstream, either:
- Update it to proxy to a locally running Navigator (`http://host.docker.internal:4200` or your host IP), or
- Serve Navigator independently and access it directly at `http://localhost:4200`.

## Troubleshooting

- If `ng build --configuration production` shows issues, use the flags shown above (`--aot=false --build-optimizer=false`).
- Ensure local bundles and paths in `config.json` are accurate and accessible by the dev server or container.
- If using TAXII, verify `taxii_collection` UUIDs and that your server allows access.
- If `/navigator/assets/config.json` or `/navigator/data/index.json` returns 403, repair shared-volume permissions once and restart nginx:
  ```bash
  docker compose exec backend sh -lc 'find /navigator-data -type d -exec chmod 755 {} + && find /navigator-data -type f -name "*.json" -exec chmod 644 {} +'
  docker compose restart nginx
  ```
- Do **not** mount a custom top-level `/etc/nginx/nginx.conf` into the proxy container for this issue; permission enforcement in backend sync and JSON fallbacks in `nginx/conf.d/hefaistos.conf` are the intended fix path.
