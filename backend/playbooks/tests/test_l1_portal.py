from types import SimpleNamespace

from django.test import SimpleTestCase

from playbooks.l1_portal import build_l1_portal_title


class BuildL1PortalTitleTests(SimpleTestCase):
    def test_uses_workbench_title_with_pb_suffix_without_plus_sign(self):
        graph = SimpleNamespace(
            title='[DE-T1567-001][P][eSeL][APP][A] Masivni exfiltrace citlivych udaju'
        )

        self.assertEqual(
            build_l1_portal_title(graph),
            '[DE-T1567-001][P][eSeL][APP][A] Masivni exfiltrace citlivych udaju PB',
        )

    def test_falls_back_to_workbench_when_title_is_blank(self):
        graph = SimpleNamespace(title='   ')
        self.assertEqual(build_l1_portal_title(graph), 'Workbench PB')
