import json
from django.contrib.auth import get_user_model
from graphene_django.utils.testing import GraphQLTestCase
from unittest.mock import patch
from organizations.models import Organization
from.models import DataSource
from .models import AttackDataImportJob, DataSourceField
from identity.models import CustomUser

class DataCatalogAPITests(GraphQLTestCase):
    def setUp(self):
        super().setUp()
        User = get_user_model()

        # Create Organization A and User A
        self.org_a = Organization.objects.create(name="Org A")
        self.user_a = User.objects.create_user(
            username="usera",
            password="password",
            organization=self.org_a,
            role=CustomUser.Roles.ADMIN,
        )

        # Create Organization B and User B
        self.org_b = Organization.objects.create(name="Org B")
        self.user_b = User.objects.create_user(
            username="userb",
            password="password",
            organization=self.org_b,
            role=CustomUser.Roles.VIEWER,
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

    def test_existing_data_source_names_is_case_insensitive(self):
        self.client.force_login(self.user_a)
        DataSource.objects.create(name="Windows Process Creation", organization=self.org_a)

        query = '''
            query ExistingNames($names: [String!]!) {
                existingDataSourceNames(names: $names)
            }
        '''
        variables = {"names": ["windows process creation", "missing source"]}

        response = self.query(query, variables=variables)
        self.assertResponseNoErrors(response)

        payload = json.loads(response.content)
        returned = payload['data']['existingDataSourceNames']
        self.assertEqual(returned, ["Windows Process Creation"])

    def test_all_data_sources_supports_filters_and_pagination(self):
        self.client.force_login(self.user_a)

        DataSource.objects.create(name="Sysmon Process", platform="Windows", organization=self.org_a)
        DataSource.objects.create(name="Syslog Auth", platform="Linux", organization=self.org_a)
        DataSource.objects.create(name="Sysmon Network", platform="Windows", organization=self.org_a)

        query = '''
            query CatalogPage($limit: Int, $offset: Int, $search: String, $platform: String) {
                allDataSources(limit: $limit, offset: $offset, search: $search, platform: $platform) {
                    name
                }
                dataSourceCount(search: $search, platform: $platform)
            }
        '''

        variables = {
            "limit": 1,
            "offset": 0,
            "search": "sysmon",
            "platform": "Windows",
        }

        response = self.query(query, variables=variables)
        self.assertResponseNoErrors(response)

        payload = json.loads(response.content)
        self.assertEqual(payload['data']['dataSourceCount'], 2)
        self.assertEqual(len(payload['data']['allDataSources']), 1)

    @patch("data_catalog.schema.import_attack_data_sources_for_organization")
    def test_admin_can_import_attack_data_sources(self, import_mock):
        self.client.force_login(self.user_a)
        import_mock.return_value = {
            "created_count": 3,
            "skipped_count": 5,
            "failed_count": 0,
            "total_candidates": 8,
            "version": "19.1",
        }

        mutation = '''
            mutation ImportAttack {
                importAttackDataSources {
                    createdCount
                    skippedCount
                    failedCount
                    totalCandidates
                    version
                }
            }
        '''

        response = self.query(mutation)
        self.assertResponseNoErrors(response)

        payload = json.loads(response.content)
        row = payload['data']['importAttackDataSources']
        self.assertEqual(row['createdCount'], 3)
        self.assertEqual(row['skippedCount'], 5)
        self.assertEqual(row['failedCount'], 0)
        self.assertEqual(row['totalCandidates'], 8)
        self.assertEqual(row['version'], "19.1")
        import_mock.assert_called_once()

    def test_non_admin_cannot_import_attack_data_sources(self):
        self.client.force_login(self.user_b)

        mutation = '''
            mutation ImportAttack {
                importAttackDataSources {
                    createdCount
                }
            }
        '''

        response = self.query(mutation)
        self.assertResponseHasErrors(response)

    @patch('data_catalog.attack_import._load_rows_from_strategy_analytics')
    def test_import_attack_data_sources_populates_required_log_source_fields(self, load_rows_mock):
        self.client.force_login(self.user_a)

        load_rows_mock.return_value = [
            {
                'data_component': 'Process Creation (DC0032)',
                'log_provider': 'WinEventLog:Security',
                'channel': 'EventCode=4688',
            }
        ]

        mutation = '''
            mutation ImportAttack {
                importAttackDataSources {
                    createdCount
                    skippedCount
                    failedCount
                    totalCandidates
                }
            }
        '''

        response = self.query(mutation)
        self.assertResponseNoErrors(response)

        imported = DataSource.objects.get(
            organization=self.org_a,
            name='WinEventLog:Security - EventCode=4688',
        )
        self.assertEqual(imported.platform, 'Windows')

        field_map = {
            row.field_name: row
            for row in DataSourceField.objects.filter(data_source=imported)
        }
        self.assertSetEqual(set(field_map.keys()), {'data_component', 'provider', 'channel'})
        self.assertEqual(field_map['data_component'].example_value, 'Process Creation (DC0032)')
        self.assertEqual(field_map['provider'].example_value, 'WinEventLog:Security')
        self.assertEqual(field_map['channel'].example_value, 'EventCode=4688')

    @patch('data_catalog.attack_import._load_rows_from_strategy_analytics')
    def test_import_attack_data_sources_migrates_legacy_auto_import_names(self, load_rows_mock):
        self.client.force_login(self.user_a)

        legacy = DataSource.objects.create(
            organization=self.org_a,
            name='Process Creation (DC0032)',
            description='Auto-added from MITRE strategy: stale data',
            platform=None,
        )

        load_rows_mock.return_value = [
            {
                'data_component': 'Process Creation (DC0032)',
                'log_provider': 'WinEventLog:Security',
                'channel': 'EventCode=4688',
            }
        ]

        mutation = '''
            mutation ImportAttack {
                importAttackDataSources {
                    createdCount
                    skippedCount
                    failedCount
                    totalCandidates
                }
            }
        '''

        response = self.query(mutation)
        self.assertResponseNoErrors(response)

        legacy.refresh_from_db()
        self.assertEqual(legacy.name, 'WinEventLog:Security - EventCode=4688')

        field_names = set(
            DataSourceField.objects.filter(data_source=legacy).values_list('field_name', flat=True)
        )
        self.assertSetEqual(field_names, {'data_component', 'provider', 'channel'})

    @patch("data_catalog.tasks.run_attack_data_import_job")
    def test_admin_can_start_async_attack_import_job(self, run_job_mock):
        self.client.force_login(self.user_a)

        mutation = '''
            mutation StartImport {
                runAttackDataImport {
                    job {
                        id
                        status
                        progressPercent
                        progressMessage
                    }
                }
            }
        '''

        response = self.query(mutation)
        self.assertResponseNoErrors(response)
        payload = json.loads(response.content)
        job = payload['data']['runAttackDataImport']['job']
        self.assertEqual(job['status'], 'PENDING')
        self.assertEqual(job['progressPercent'], 0)
        self.assertEqual(job['progressMessage'], 'Queued')
        run_job_mock.assert_called_once()

    def test_admin_can_query_attack_import_jobs(self):
        self.client.force_login(self.user_a)

        AttackDataImportJob.objects.create(
            organization=self.org_a,
            status=AttackDataImportJob.Status.SUCCESS,
            progress_percent=100,
            progress_message='Done',
            created_count=10,
            skipped_count=2,
            failed_count=0,
            total_candidates=12,
            triggered_by=self.user_a,
        )

        query = '''
            query Jobs($limit: Int) {
                attackDataImportJobs(limit: $limit) {
                    status
                    progressPercent
                    createdCount
                    skippedCount
                    failedCount
                    totalCandidates
                }
            }
        '''

        response = self.query(query, variables={"limit": 5})
        self.assertResponseNoErrors(response)
        payload = json.loads(response.content)
        jobs = payload['data']['attackDataImportJobs']
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]['status'], 'SUCCESS')
        self.assertEqual(jobs[0]['createdCount'], 10)

    def test_non_admin_cannot_query_attack_import_jobs(self):
        self.client.force_login(self.user_b)

        query = '''
            query Jobs {
                attackDataImportJobs(limit: 1) {
                    id
                }
            }
        '''

        response = self.query(query)
        self.assertResponseHasErrors(response)
