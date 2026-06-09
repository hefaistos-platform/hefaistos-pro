"""
Azure Sentinel (Microsoft Sentinel) deployment engine.

Authenticates via OAuth 2.0 client_credentials flow and creates / upserts
Scheduled Query Rule (analytics rule) via the Azure Monitor / Sentinel REST API.

Required credentials:
    tenant_id      – Azure AD tenant ID
    client_id      – App registration client ID
    client_secret  – App registration client secret
    subscription_id – Azure subscription ID
    resource_group  – Resource group name
    workspace_name  – Log Analytics workspace name
"""

import logging
import requests

from .base import PlatformDeployer, DeploymentResult, parse_http_error

logger = logging.getLogger(__name__)

_TOKEN_URL = 'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
_SCOPE = 'https://management.azure.com/.default'
_RULE_URL = (
    'https://management.azure.com'
    '/subscriptions/{subscription_id}'
    '/resourceGroups/{resource_group}'
    '/providers/Microsoft.OperationalInsights'
    '/workspaces/{workspace_name}'
    '/providers/Microsoft.SecurityInsights'
    '/alertRules/{rule_id}'
    '?api-version=2022-12-01-preview'
)
_SENTINEL_QUERY_LIMIT = 10000


class SentinelDeployer(PlatformDeployer):
    """Deploys KQL analytics rules to Azure Sentinel."""

    PLATFORM_NAME = 'Azure Sentinel'

    # ------------------------------------------------------------------
    # Credential validation
    # ------------------------------------------------------------------

    def validate_credentials(self) -> tuple[bool, str]:
        required = ('tenant_id', 'client_id', 'client_secret',
                    'subscription_id', 'resource_group', 'workspace_name')
        missing = [k for k in required if not self.credentials.get(k)]
        if missing:
            return False, f"Missing required fields: {', '.join(missing)}"
        return True, ''

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self) -> bool:
        tenant_id = self.credentials['tenant_id']
        resp = requests.post(
            _TOKEN_URL.format(tenant_id=tenant_id),
            data={
                'grant_type': 'client_credentials',
                'client_id': self.credentials['client_id'],
                'client_secret': self.credentials['client_secret'],
                'scope': _SCOPE,
            },
            timeout=30,
        )
        resp.raise_for_status()
        self._token = resp.json().get('access_token')
        logger.info('[%s] Authenticated successfully.', self.PLATFORM_NAME)
        return bool(self._token)

    # ------------------------------------------------------------------
    # Rule deployment
    # ------------------------------------------------------------------

    def deploy_rule(self, rule_data: dict) -> DeploymentResult:
        import uuid as _uuid

        platforms = rule_data.get('platforms', {})
        kql_block = platforms.get('kql', {})
        query = kql_block.get('query', '') if isinstance(kql_block, dict) else ''

        if not query:
            return DeploymentResult(
                platform=self.PLATFORM_NAME,
                success=False,
                message='No KQL query found in OpenTide rule for Sentinel deployment.',
            )

        is_valid, errors = self.validate_query(query, rule_data)
        if not is_valid:
            return DeploymentResult(
                platform=self.PLATFORM_NAME,
                success=False,
                message='KQL query validation failed.',
                errors=errors,
            )

        metadata = rule_data.get('metadata', {})
        rule_uuid = str(metadata.get('uuid', _uuid.uuid4()))
        severity_map = {
            'CRITICAL': 'High',
            'HIGH': 'High',
            'MEDIUM': 'Medium',
            'LOW': 'Low',
        }
        severity = severity_map.get(str(metadata.get('severity', 'MEDIUM')).upper(), 'Medium')

        payload = {
            'kind': 'Scheduled',
            'properties': {
                'displayName': metadata.get('title', 'OpenTide Rule'),
                'description': metadata.get('description', ''),
                'severity': severity,
                'enabled': True,
                'query': query,
                'queryFrequency': 'PT5H',
                'queryPeriod': 'P1D',
                'triggerOperator': 'GreaterThan',
                'triggerThreshold': 0,
                'suppressionDuration': 'PT1H',
                'suppressionEnabled': False,
            },
        }

        url = _RULE_URL.format(
            subscription_id=self.credentials['subscription_id'],
            resource_group=self.credentials['resource_group'],
            workspace_name=self.credentials['workspace_name'],
            rule_id=rule_uuid,
        )

        resp = requests.put(
            url,
            json=payload,
            headers={
                'Authorization': f'Bearer {self._token}',
                'Content-Type': 'application/json',
            },
            timeout=30,
        )
        if not (200 <= resp.status_code < 300):
            summary, details = parse_http_error(resp, platform='Microsoft Graph')
            return DeploymentResult(
                platform=self.PLATFORM_NAME,
                success=False,
                message=f'{summary}. See errors for details.',
                errors=details,
            )

        logger.info('[%s] Rule deployed: %s', self.PLATFORM_NAME, rule_uuid)
        return DeploymentResult(
            platform=self.PLATFORM_NAME,
            success=True,
            rule_id=rule_uuid,
            message=f'Analytics rule deployed successfully (ID: {rule_uuid})',
        )

    # ------------------------------------------------------------------
    # Query validation
    # ------------------------------------------------------------------

    def validate_query(self, query: str, rule_data: dict | None = None) -> tuple[bool, list[str]]:
        errors: list[str] = []
        q = query.strip()
        if not q:
            errors.append('Query is empty.')
        if len(q) > _SENTINEL_QUERY_LIMIT:
            errors.append(
                f'Sentinel KQL query exceeds {_SENTINEL_QUERY_LIMIT} characters and will be rejected.'
            )
        return (len(errors) == 0, errors)
