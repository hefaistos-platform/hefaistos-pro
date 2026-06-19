import json

from django.contrib.auth import get_user_model
from graphene_django.utils.testing import GraphQLTestCase

from ach.models import ACHAnalysis
from advops.models import ADVOPSReport
from organizations.models import Organization
from playbooks.models import PlaybookGraph


class BotAuditorReadVisibilityTests(GraphQLTestCase):
    def setUp(self):
        super().setUp()
        User = get_user_model()

        self.org_a = Organization.objects.create(name="Org A")
        self.org_b = Organization.objects.create(name="Org B")

        self.user_a = User.objects.create_user(
            username="author-a",
            password="password",
            organization=self.org_a,
            role="ADMIN",
        )
        self.user_b = User.objects.create_user(
            username="author-b",
            password="password",
            organization=self.org_b,
            role="ADMIN",
        )

        self.bot_org = User.objects.create_user(
            username="bot-org",
            password="password",
            organization=self.org_a,
            role="BOT_AUDITOR_ORG",
        )
        self.bot_global = User.objects.create_user(
            username="bot-global",
            password="password",
            organization=None,
            role="BOT_AUDITOR_GLOBAL",
        )

        PlaybookGraph.objects.create(
            title="Graph A",
            organization=self.org_a,
            author=self.user_a,
            status="IDEA",
            is_shared=False,
        )
        PlaybookGraph.objects.create(
            title="Graph B",
            organization=self.org_b,
            author=self.user_b,
            status="IDEA",
            is_shared=False,
        )

        ACHAnalysis.objects.create(
            title="ACH A",
            description="A",
            owner=self.user_a,
            status="RESEARCH",
        )
        ACHAnalysis.objects.create(
            title="ACH B",
            description="B",
            owner=self.user_b,
            status="RESEARCH",
        )

        ADVOPSReport.objects.create(
            hunt_id="ADV-2099-01-001",
            hypothesis="Hunt A",
            author=self.user_a,
            organization=self.org_a,
            status=ADVOPSReport.Status.IDEA,
        )
        ADVOPSReport.objects.create(
            hunt_id="ADV-2099-01-002",
            hypothesis="Hunt B",
            author=self.user_b,
            organization=self.org_b,
            status=ADVOPSReport.Status.IDEA,
        )

    def _query_counts(self):
        query = """
            query BotVisibility {
                allPlaybookGraphs { id }
                achAnalyses { id }
                allAdvopsReports { id }
            }
        """
        response = self.query(query)
        self.assertResponseNoErrors(response)
        payload = json.loads(response.content)["data"]
        return (
            len(payload["allPlaybookGraphs"]),
            len(payload["achAnalyses"]),
            len(payload["allAdvopsReports"]),
        )

    def test_org_bot_sees_org_scoped_items(self):
        self.client.force_login(self.bot_org)
        graph_count, ach_count, advops_count = self._query_counts()
        self.assertEqual(graph_count, 1)
        self.assertEqual(ach_count, 1)
        self.assertEqual(advops_count, 1)

    def test_global_bot_sees_platform_scoped_items(self):
        self.client.force_login(self.bot_global)
        graph_count, ach_count, advops_count = self._query_counts()
        self.assertEqual(graph_count, 2)
        self.assertEqual(ach_count, 2)
        self.assertEqual(advops_count, 2)
