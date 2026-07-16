from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase
from graphql import GraphQLError

from identity.decorators import Roles
from organizations.models import MISPInstance, Organization
from waiting_room.models import WaitingCase
from waiting_room.schema import (
    CreateWaitingCase,
    ImportWaitingCasesFromMISP,
    PromoteWaitingCaseToWorkbench,
)


class WaitingRoomPermissionTests(SimpleTestCase):
    def _info(self, role):
        user = SimpleNamespace(
            is_anonymous=False,
            role=role,
            is_superuser=False,
            is_staff=False,
            organization=SimpleNamespace(id='org-1'),
            id='u-1',
        )
        return SimpleNamespace(context=SimpleNamespace(user=user))

    def test_create_requires_reviewer_or_admin(self):
        with self.assertRaises(Exception):
            CreateWaitingCase.mutate(
                None,
                self._info(Roles.ANALYST),
                input=SimpleNamespace(title='X', short_description='Y'),
                auto_enrich=False,
            )

    def test_promote_requires_analyst(self):
        with self.assertRaises(Exception):
            PromoteWaitingCaseToWorkbench.mutate(
                None,
                self._info(Roles.REVIEWER),
                id='00000000-0000-0000-0000-000000000001',
                title='Test',
            )


class WaitingRoomBusinessTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.org = Organization.objects.create(name='Waiting Org')
        self.reviewer = user_model.objects.create_user(
            username='reviewer',
            password='pw',
            organization=self.org,
            role=Roles.REVIEWER,
        )
        self.analyst = user_model.objects.create_user(
            username='analyst',
            password='pw',
            organization=self.org,
            role=Roles.ANALYST,
        )
        self.misp = MISPInstance.objects.create(
            organization=self.org,
            name='Main MISP',
            url='https://misp.example',
            auth_key='secret',
            verify_ssl=False,
        )

    def _info(self, user):
        return SimpleNamespace(context=SimpleNamespace(user=user))

    def test_required_fields_validation(self):
        with self.assertRaises(GraphQLError):
            CreateWaitingCase.mutate(
                None,
                self._info(self.reviewer),
                input=SimpleNamespace(title='   ', short_description='ok'),
                auto_enrich=False,
            )

        with self.assertRaises(GraphQLError):
            CreateWaitingCase.mutate(
                None,
                self._info(self.reviewer),
                input=SimpleNamespace(title='ok', short_description=' '),
                auto_enrich=False,
            )

    @patch('waiting_room.schema.fetch_misp_events')
    def test_misp_import_dedupes_by_instance_and_event(self, mock_fetch):
        mock_fetch.return_value = [
            {'id': '1001', 'info': 'Event A', 'Attribute': []},
            {'id': '1001', 'info': 'Event A Duplicate', 'Attribute': []},
        ]

        result = ImportWaitingCasesFromMISP.mutate(
            None,
            self._info(self.reviewer),
            misp_instance_id=self.misp.id,
            event_id=None,
            tag=None,
            limit=25,
            run_ai_enrichment=False,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.imported_count, 1)
        self.assertEqual(result.skipped_count, 1)
        self.assertEqual(
            WaitingCase.objects.filter(misp_instance=self.misp, misp_event_id='1001').count(),
            1,
        )

    @patch('waiting_room.schema.fetch_misp_events')
    def test_misp_import_filters_by_required_tag(self, mock_fetch):
        mock_fetch.return_value = [
            {'id': '2001', 'info': 'Tagged Event', 'Attribute': [], 'Tag': [{'name': 'HEFAISTOS'}]},
            {'id': '2002', 'info': 'Not Tagged Event', 'Attribute': [], 'Tag': [{'name': 'OTHER'}]},
        ]

        result = ImportWaitingCasesFromMISP.mutate(
            None,
            self._info(self.reviewer),
            misp_instance_id=self.misp.id,
            event_id=None,
            tag='HEFAISTOS',
            limit=25,
            run_ai_enrichment=False,
        )

        self.assertTrue(result.success)
        self.assertEqual(result.imported_count, 1)
        self.assertEqual(result.skipped_count, 1)
        self.assertTrue(WaitingCase.objects.filter(misp_instance=self.misp, misp_event_id='2001').exists())
        self.assertFalse(WaitingCase.objects.filter(misp_instance=self.misp, misp_event_id='2002').exists())

    def test_promote_creates_workbench_and_marks_case_promoted(self):
        waiting_case = WaitingCase.objects.create(
            organization=self.org,
            created_by=self.reviewer,
            title='Suspicious PowerShell',
            short_description='Detect suspicious powershell with encoded command',
            detection_objective='Track suspicious process chain and script artifacts.',
            mapped_ttps=['T1059.001'],
            status=WaitingCase.LifecycleStatus.READY,
        )

        result = PromoteWaitingCaseToWorkbench.mutate(
            None,
            self._info(self.analyst),
            id=waiting_case.id,
            title='Promoted PowerShell Case',
        )

        self.assertTrue(result.success)
        waiting_case.refresh_from_db()
        self.assertEqual(waiting_case.status, WaitingCase.LifecycleStatus.PROMOTED)
        self.assertIsNotNone(waiting_case.promoted_graph_id)
        self.assertEqual(waiting_case.promoted_graph.goal, waiting_case.short_description)
        self.assertEqual(waiting_case.promoted_graph.technical_context, waiting_case.detection_objective)
