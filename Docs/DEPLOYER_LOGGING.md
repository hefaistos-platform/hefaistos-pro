# Deployer logging

Backend deployer logs are enabled by default through the `rules.deployers` logger.

- Default level: `INFO`
- Override with: `HEFAISTOS_DEPLOYER_LOG_LEVEL`

Example:

```bash
export HEFAISTOS_DEPLOYER_LOG_LEVEL=DEBUG
```

After setting the variable, restart the backend container and inspect logs with:

```bash
docker logs <backend>
```
