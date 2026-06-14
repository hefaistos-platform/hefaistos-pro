from django.contrib.auth import get_user_model
from graphene_django.utils.testing import GraphQLTestCase
import json
from django.test import TestCase
from unittest.mock import MagicMock
from .models import Organization, MISPInstance, MISP_INSTANCE_LIMIT
from .schema import UpdateOrganization

class OrganizationModelTests(TestCase):

    def test_create_organization(self):
        """
        Tests that an organization can be created successfully.
        """
        org_name = "Test Org"
        org = Organization.objects.create(name=org_name)
        self.assertEqual(org.name, org_name)
        self.assertIsNotNone(org.id)
        self.assertEqual(str(org), org_name)

class OrganizationAPITests(GraphQLTestCase):
    def setUp(self):
        super().setUp()
        User = get_user_model()

        # Create Organization A and User A
        self.org_a = Organization.objects.create(name="Org A")
        self.user_a = User.objects.create_user(
            username="usera",
            password="password",
            organization=self.org_a
        )

        # Create Organization B and User B
        self.org_b = Organization.objects.create(name="Org B")
        self.user_b = User.objects.create_user(
            username="userb",
            password="password",
            organization=self.org_b
        )

    def test_user_can_only_see_own_organization(self):
        """
        Tests that a user authenticated for one organization cannot see
        data from another organization. This is a critical data isolation test.
        """
        # Authenticate as User A
        self.client.force_login(self.user_a)

        # Define the GraphQL query
        query = '''
            query {
                myOrganization {
                    id
                    name
                }
            }
        '''

        # Execute the query
        response = self.query(query)

        # Check the response
        self.assertResponseNoErrors(response)
        content = json.loads(response.content)

        # Assert that the data returned is for Org A
        data = content['data']['myOrganization']
        self.assertEqual(data['name'], "Org A")
        self.assertEqual(data['id'], str(self.org_a.id))


class MISPInstanceModelTests(TestCase):
    """Tests for the MISPInstance model."""

    def setUp(self):
        self.org = Organization.objects.create(name="MISP Test Org")

    def test_create_misp_instance(self):
        """MISPInstance can be created and retrieved."""
        inst = MISPInstance.objects.create(
            organization=self.org,
            name="Test MISP",
            url="https://misp.example.com",
            auth_key="abc123",
        )
        self.assertEqual(inst.name, "Test MISP")
        self.assertEqual(inst.url, "https://misp.example.com")
        self.assertTrue(inst.verify_ssl)
        self.assertIn("Test MISP", str(inst))

    def test_misp_instance_limit_constant(self):
        """MISP_INSTANCE_LIMIT is defined and equals 5."""
        self.assertEqual(MISP_INSTANCE_LIMIT, 5)

    def test_unique_together_name_org(self):
        """Two instances with the same name in the same org are not allowed."""
        from django.db import IntegrityError
        MISPInstance.objects.create(organization=self.org, name="Dup", url="https://a.example.com", auth_key="k1")
        with self.assertRaises(IntegrityError):
            MISPInstance.objects.create(organization=self.org, name="Dup", url="https://b.example.com", auth_key="k2")

    def test_same_name_different_org(self):
        """Two instances with the same name in different orgs are allowed."""
        org2 = Organization.objects.create(name="MISP Test Org 2")
        MISPInstance.objects.create(organization=self.org, name="Shared", url="https://a.example.com", auth_key="k1")
        inst2 = MISPInstance.objects.create(organization=org2, name="Shared", url="https://b.example.com", auth_key="k2")
        self.assertIsNotNone(inst2.id)


class OrganizationUserLimitMutationTests(TestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.org = Organization.objects.create(name="Limited Org", max_users=5)
        self.superuser = self.user_model.objects.create_superuser(
            username="org_limit_super",
            email="org_limit_super@example.com",
            password="SuperPass123!",
        )
        self.user_model.objects.create_user(
            username="member_one",
            email="member_one@example.com",
            password="MemberPass123!",
            organization=self.org,
        )
        self.user_model.objects.create_user(
            username="member_two",
            email="member_two@example.com",
            password="MemberPass123!",
            organization=self.org,
        )

    def _make_info(self, user):
        info = MagicMock()
        info.context.user = user
        return info

    def test_update_organization_rejects_max_users_below_current_members(self):
        mutation = UpdateOrganization()
        result = mutation.mutate(
            self._make_info(self.superuser),
            id=self.org.id,
            max_users=1,
        )
        self.assertFalse(result.success)
        self.assertIn("Cannot set max users below current member count", result.message)
        self.org.refresh_from_db()
        self.assertEqual(self.org.max_users, 5)
