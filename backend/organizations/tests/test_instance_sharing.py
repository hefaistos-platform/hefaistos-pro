from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from organizations.models import HefaistosInboundShareKey, HefaistosInstanceIdentity, Organization
from organizations.sharing import hash_api_key, key_allows_scope


class SharingScopePermissionTests(TestCase):
    def test_key_allows_scope_rules(self):
        self.assertTrue(key_allows_scope(['ALL'], 'WORKBENCH'))
        self.assertTrue(key_allows_scope(['WORKBENCH', 'RULES', 'ACH'], 'ALL'))
        self.assertTrue(key_allows_scope(['RULES'], 'RULES'))
        self.assertFalse(key_allows_scope(['WORKBENCH'], 'ALL'))
        self.assertFalse(key_allows_scope(['WORKBENCH'], 'RULES'))


class SharingApiEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='Sharing Org')
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            username='sharing_admin',
            password='pass1234',
            organization=self.org,
            role='ADMIN',
        )
        self.raw_key = 'hefshare_test_readonly_key'
        HefaistosInboundShareKey.objects.create(
            organization=self.org,
            name='test-key',
            key_hash=hash_api_key(self.raw_key),
            key_hint='test...key',
            allowed_scopes=['WORKBENCH'],
            is_active=True,
            created_by=self.admin,
        )

    def test_sharing_info_requires_valid_key(self):
        response = self.client.get('/api/sharing/info')
        self.assertEqual(response.status_code, 403)

    def test_sharing_info_returns_instance_metadata(self):
        response = self.client.get(
            '/api/sharing/info',
            **{'HTTP_X_HEFAISTOS_SHARE_KEY': self.raw_key},
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn('instance_id', body)
        self.assertEqual(body.get('mode'), 'PULL_READ_ONLY')

    def test_export_scope_must_be_allowed(self):
        denied = self.client.get(
            '/api/sharing/export?scope=RULES',
            **{'HTTP_X_HEFAISTOS_SHARE_KEY': self.raw_key},
        )
        self.assertEqual(denied.status_code, 403)

        allowed = self.client.get(
            '/api/sharing/export?scope=WORKBENCH',
            **{'HTTP_X_HEFAISTOS_SHARE_KEY': self.raw_key},
        )
        self.assertEqual(allowed.status_code, 200)
        body = allowed.json()
        self.assertEqual(body.get('scope'), 'WORKBENCH')
        self.assertIn('workbenches', body)
        self.assertEqual(body.get('permissions', {}).get('mode'), 'PULL_READ_ONLY')

    def test_export_endpoint_is_read_only(self):
        response = self.client.post(
            '/api/sharing/export',
            **{'HTTP_X_HEFAISTOS_SHARE_KEY': self.raw_key},
        )
        self.assertEqual(response.status_code, 405)

    def test_get_endpoints_do_not_mutate_remote_state(self):
        self.assertEqual(HefaistosInstanceIdentity.objects.count(), 0)
        key_obj = HefaistosInboundShareKey.objects.get(organization=self.org, name='test-key')
        self.assertIsNone(key_obj.last_used_at)

        info_response = self.client.get(
            '/api/sharing/info',
            **{'HTTP_X_HEFAISTOS_SHARE_KEY': self.raw_key},
        )
        self.assertEqual(info_response.status_code, 200)

        export_response = self.client.get(
            '/api/sharing/export?scope=WORKBENCH',
            **{'HTTP_X_HEFAISTOS_SHARE_KEY': self.raw_key},
        )
        self.assertEqual(export_response.status_code, 200)

        key_obj.refresh_from_db()
        self.assertIsNone(key_obj.last_used_at)
        self.assertEqual(HefaistosInstanceIdentity.objects.count(), 0)
