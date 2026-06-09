from unittest.mock import patch

from django.test import SimpleTestCase

from rules.deployers.sentinel import SentinelDeployer


class _MockResponse:
    def __init__(self, status_code=200, json_data=None, text=''):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text

    def json(self):
        return self._json_data


class TestSentinelDeployer(SimpleTestCase):
    def setUp(self):
        self.deployer = SentinelDeployer({
            'tenant_id': 't',
            'client_id': 'c',
            'client_secret': 's',
            'subscription_id': 'sub',
            'resource_group': 'rg',
            'workspace_name': 'ws',
        })
        self.deployer._token = 'tok'
        self.rule = {
            'metadata': {'title': 'Rule', 'uuid': '11111111-1111-1111-1111-111111111111'},
            'platforms': {'kql': {'query': 'SecurityEvent | take 10'}},
        }

    @patch('rules.deployers.sentinel.requests.put')
    def test_parses_graph_style_error(self, mock_put):
        mock_put.return_value = _MockResponse(
            status_code=400,
            json_data={'error': {'code': 'BadRequest', 'message': 'Invalid query'}},
        )
        result = self.deployer.deploy_rule(self.rule)
        self.assertFalse(result.success)
        self.assertIn('Microsoft Graph rejected the rule', result.message)
        self.assertIn('Invalid query', result.errors)

    def test_preflight_query_length_limit(self):
        valid, errors = self.deployer.validate_query('A' * 10001)
        self.assertFalse(valid)
        self.assertTrue(any('exceeds 10000 characters' in item for item in errors))
