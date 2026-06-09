import os
import logging
import requests
import json

# Setup logger for the SDK
logger = logging.getLogger(__name__)

def get_secret(secret_name, default_env_var=None):
    """
    Reads a secret from a Docker secret file.
    Falls back to an environment variable if the file doesn't exist.
    """
    secret_path = f"/run/secrets/{secret_name}"
    try:
        with open(secret_path, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        # Fallback to environment variable
        if default_env_var:
            return os.environ.get(default_env_var)
        return None

# Import all GraphQL queries and mutations
from .graphql_queries import (
    GET_USERS_QUERY,
    GET_GRAPH_TITLE_QUERY,
    GET_ALL_ATTACK_QUERY,
    CREATE_NOTIFICATION_MUTATION,
    CREATE_PLAYBOOK_MUTATION,
    UPDATE_PLAYBOOK_STATUS_MUTATION,
    UPDATE_PLAYBOOK_LINKS_MUTATION,
    CREATE_PLAYBOOK_GRAPH_MUTATION,
    CREATE_PLAYBOOK_NODE_MUTATION,
    UPDATE_NODE_TEMPLATE_MUTATION
)
from .graphql_queries import UPDATE_PLAYBOOK_DETAILS_MUTATION
from .graphql_queries import GET_REPO_DETAILS_QUERY, UPSERT_RULE_MUTATION, UPDATE_REPO_LAST_SYNC_MUTATION, GET_FULL_PLAYBOOK_DETAILS_QUERY

class HefaistosApiClient:
    """
    A client for interacting with the HEFAISTOS GraphQL API.
    """

    def __init__(self, api_url=None, api_token=None):
        import time
        
        self.api_url = api_url or os.environ.get('HEFAISTOS_API_URL')
        self.api_token = api_token or get_secret('api_token', 'HEFAISTOS_API_TOKEN')

        # Fallback: read token from file if direct token not provided
        # Retry logic to handle timing issues when backend hasn't written token yet
        if (not self.api_token) and self.api_url:
            token_file = os.environ.get('HEFAISTOS_API_TOKEN_FILE')
            if token_file:
                max_retries = 30  # Wait up to 30 seconds for token file
                for attempt in range(max_retries):
                    if os.path.isfile(token_file):
                        try:
                            with open(token_file, 'r', encoding='utf-8') as f:
                                contents = f.read().strip()
                                if contents:
                                    self.api_token = contents
                                    logger.info(f"Loaded API token from file '{token_file}' (attempt {attempt + 1}).")
                                    break
                                else:
                                    logger.warning(f"Token file '{token_file}' is empty, waiting... (attempt {attempt + 1})")
                        except OSError as e:
                            logger.warning(f"Failed to read token file '{token_file}': {e} (attempt {attempt + 1})")
                    else:
                        logger.warning(f"Token file '{token_file}' does not exist yet, waiting... (attempt {attempt + 1})")
                    
                    if attempt < max_retries - 1:
                        time.sleep(1)
                
                if not self.api_token:
                    logger.error(f"Token file '{token_file}' not available after {max_retries} attempts.")

        if not self.api_url or not self.api_token:
            raise ValueError("API_URL and API_TOKEN must be provided or set as environment variables.")

        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}"
        }
        # Log masked token for debugging (show first 10 and last 10 chars)
        token_masked = f"{self.api_token[:10]}...{self.api_token[-10:]}" if len(self.api_token) > 20 else "***"
        logger.info(f"HefaistosApiClient initialized for {self.api_url} with token: {token_masked}")

    def _call_api(self, query, variables=None):
        """
        Private method to send a GraphQL query/mutation.
        """
        body = {"query": query, "variables": variables or {}}
        logger.info(f"[_call_api] Making request to {self.api_url}")
        logger.debug(f"[_call_api] Request body: {body}")
        try:
            response = requests.post(self.api_url, headers=self.headers, json=body, timeout=10)
            logger.info(f"[_call_api] Response status: {response.status_code}")
            
            if response.status_code == 401:
                logger.error(f"[_call_api] Authentication failed (401) - JWT token may be expired or invalid")
            
            # For debugging: Log response text for non-2xx responses
            if response.status_code >= 400:
                logger.warning(f"[_call_api] Error response body: {response.text[:500]}")
            
            response.raise_for_status()

            response_json = response.json()
            if "errors" in response_json:
                logger.error(f"[_call_api] GraphQL errors: {response_json['errors']}")
                logger.error(f"[_call_api] Variables: {variables}")
                # Check if it's an authentication error
                for err in response_json.get('errors', []):
                    if 'authentication' in str(err).lower() or 'credentials' in str(err).lower():
                        logger.error("[_call_api] Authentication error detected in GraphQL response")
                return None

            logger.debug(f"[_call_api] Response data: {response_json.get('data')}")
            return response_json.get('data')

        except requests.exceptions.RequestException as e:
            logger.error(f"[_call_api] Request failed: {e}")
            logger.error(f"[_call_api] Variables: {variables}")
            return None

    # --- Helper Methods ---

    def get_org_users(self, org_id, exclude_author_id):
        vars = {"orgId": org_id, "excludeAuthorId": exclude_author_id}
        return self._call_api(GET_USERS_QUERY, vars)


    def get_graph_title(self, graph_id):
        """Fetches a v2 graph's title."""
        return self._call_api(GET_GRAPH_TITLE_QUERY, {"graphId": graph_id})

    def get_attack_map(self):
        return self._call_api(GET_ALL_ATTACK_QUERY)

    def create_notification(self, recipient_id, actor_id, org_id, verb, object_id, content_type):
        vars = {
            "recipientId": recipient_id, "actorId": actor_id, "organizationId": org_id,
            "verb": verb, "objectId": object_id, "contentType": content_type
        }
        return self._call_api(CREATE_NOTIFICATION_MUTATION, vars)

    def create_playbook(self, title, description, analytic_id):
        vars = {
            "title": title,
            "description": description,
            "analyticId": analytic_id,
            "playbookType": "HUNT",
            "status": "IDEA"
        }
        return self._call_api(CREATE_PLAYBOOK_MUTATION, vars)

    def update_playbook_status(self, playbook_id, status):
        vars = {"playbookId": playbook_id, "status": status}
        return self._call_api(UPDATE_PLAYBOOK_STATUS_MUTATION, vars)

    def update_playbook_links(self, playbook_id, attack_ids):
        vars = {"playbookId": playbook_id, "mitreAttackIds": attack_ids}
        return self._call_api(UPDATE_PLAYBOOK_LINKS_MUTATION, vars)

    # --- V2 GRAPH METHODS ---

    def create_playbook_graph(self, title):
        """Creates a new, blank v2 Playbook Graph."""
        return self._call_api(CREATE_PLAYBOOK_GRAPH_MUTATION, {"title": title})

    def create_playbook_node(self, graph_id, layer_name, x=100, y=100):
        """Adds a new node to a graph."""
        vars = {"graphId": graph_id, "layerName": layer_name, "x": x, "y": y}
        return self._call_api(CREATE_PLAYBOOK_NODE_MUTATION, vars)

    def update_node_template(self, node_id, template_data_dict, attack_ids=None):
        """Updates the dcg420 template data for a single node."""
        vars = {
            "nodeId": node_id,
            "templateData": json.dumps(template_data_dict),
            "mitreAttackIds": attack_ids or []
        }
        return self._call_api(UPDATE_NODE_TEMPLATE_MUTATION, vars)

    def update_playbook_details(self, **kwargs):
        """Updates Workbench (PlaybookGraph) details including strategy, context, testing, and SOAR.
        Accepts camelCase keys aligned with GraphQL schema, e.g., graphId, goal, technicalContext, enrichmentSteps.
        """
        # For JSON fields, ensure strings are passed (GraphQL JSONString expects string)
        vars = dict(kwargs)
        for key in ("selectedStrategy", "enrichmentSteps", "containmentSteps", "notificationSteps"):
            if key in vars and not isinstance(vars[key], str):
                try:
                    vars[key] = json.dumps(vars[key])
                except Exception:
                    pass
        return self._call_api(UPDATE_PLAYBOOK_DETAILS_MUTATION, vars)

    # --- RULES METHODS ---

    def get_repository_details(self, repo_id):
        """Fetches a repo's details including decrypted token (if permitted)."""
        return self._call_api(GET_REPO_DETAILS_QUERY, {"repoId": repo_id})

    def upsert_rule(self, rule_data: dict):
        """Creates or updates a detection rule from a parsed Sigma file."""
        return self._call_api(UPSERT_RULE_MUTATION, rule_data)

    def update_repo_last_sync(self, repo_id):
        """Sets repository last_sync to now on the server side."""
        return self._call_api(UPDATE_REPO_LAST_SYNC_MUTATION, {"repoId": repo_id})

    def get_full_playbook_details(self, playbook_id):
        """Fetches the complete, detailed playbook object for YAML conversion."""
        return self._call_api(GET_FULL_PLAYBOOK_DETAILS_QUERY, {"id": playbook_id})

