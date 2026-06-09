from django.test import TestCase
import json
from django.contrib.auth import get_user_model
from graphene_django.utils.testing import GraphQLTestCase
from organizations.models import Organization
from.models import DataSource

class DataCatalogAPITests(GraphQLTestCase):
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

        # Create a data source owned by Org A
        self.data_source_a = DataSource.objects.create(
            name="Sysmon A",
            organization=self.org_a
        )

    def test_user_cannot_add_field_to_other_orgs_data_source(self):
        """
        SECURITY TEST: Ensures a user from one org cannot add a field to a data source
        owned by another organization.
        """
        # Authenticate as User B (the "attacker")
        self.client.force_login(self.user_b)

        mutation = '''
            mutation AddField($dsId: ID!, $fieldName: String!) {
                addDataSourceField(dataSourceId: $dsId, fieldName: $fieldName) {
                    dataSourceField { id }
                }
            }
        '''
        variables = {
            "dsId": str(self.data_source_a.id),
            "fieldName": "malicious_field"
        }

        response = self.query(mutation, variables=variables)

        # Assert that the API returns an error
        self.assertResponseHasErrors(response)

        # Verify the error message indicates a permission issue or that the object was not found
        content = json.loads(response.content)
        self.assertIn("not found or you do not have permission", content['errors'][0]['message'])
