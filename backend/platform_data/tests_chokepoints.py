from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import TestCase

from platform_data.models import (
    ChokepointEntry,
    ChokepointSnapshot,
    PlatformDataVersion,
)
from platform_data.schema import _activate_chokepoint_snapshot


class ChokepointImportCommandTests(TestCase):
    def test_remote_import_stages_snapshot_entries(self):
        snapshot = ChokepointSnapshot.objects.create(
            source_repo="https://github.com/iimp0ster/detection-chokepoints",
            source_ref="main",
            status=ChokepointSnapshot.Status.STAGED,
        )

        sample_yaml = """
chokepoints:
  - id: cp-01
    title: Script interpreter execution chokepoint
    technique: T1059.001
    tactic: Execution
    telemetry_prerequisites:
      - process_create
      - command_line
    native_rule_hints:
      kql:
        - DeviceProcessEvents | where ProcessCommandLine has "powershell"
      spl:
        - index=edr sourcetype=process
      wazuh_xml:
        - '<rule id="100001" level="10"></rule>'
"""

        with patch(
            "platform_data.management.commands.import_detection_chokepoints.list_remote_chokepoint_paths",
            return_value=["chokepoints/windows/script_exec.yml"],
        ), patch(
            "platform_data.management.commands.import_detection_chokepoints.fetch_remote_chokepoint_text",
            return_value=sample_yaml,
        ), patch(
            "platform_data.management.commands.import_detection_chokepoints.fetch_latest_ref_sha",
            return_value="0123456789abcdef0123456789abcdef01234567",
        ):
            call_command(
                "import_detection_chokepoints",
                snapshot_id=str(snapshot.id),
                mode="remote",
                source_repo="https://github.com/iimp0ster/detection-chokepoints",
                ref="main",
            )

        snapshot.refresh_from_db()
        self.assertEqual(snapshot.status, ChokepointSnapshot.Status.STAGED)
        self.assertEqual(snapshot.entry_count, 1)
        self.assertEqual(snapshot.source_sha, "0123456789abcdef0123456789abcdef01234567")

        entry = ChokepointEntry.objects.get(snapshot=snapshot)
        self.assertEqual(entry.primary_technique_id, "T1059")
        self.assertEqual(entry.sub_technique_id, "T1059.001")
        self.assertIn("kql", entry.native_rule_hints)
        self.assertTrue(entry.native_rule_hints["kql"])

    def test_remote_import_marks_snapshot_failed_on_empty_input(self):
        snapshot = ChokepointSnapshot.objects.create(
            source_repo="https://github.com/iimp0ster/detection-chokepoints",
            source_ref="main",
            status=ChokepointSnapshot.Status.STAGED,
        )

        with patch(
            "platform_data.management.commands.import_detection_chokepoints.list_remote_chokepoint_paths",
            return_value=[],
        ):
            with self.assertRaises(CommandError):
                call_command(
                    "import_detection_chokepoints",
                    snapshot_id=str(snapshot.id),
                    mode="remote",
                    source_repo="https://github.com/iimp0ster/detection-chokepoints",
                    ref="main",
                )

        snapshot.refresh_from_db()
        self.assertEqual(snapshot.status, ChokepointSnapshot.Status.FAILED)


class ChokepointActivationTests(TestCase):
    def test_activate_snapshot_archives_previous_and_updates_version(self):
        old_active = ChokepointSnapshot.objects.create(
            source_repo="https://github.com/iimp0ster/detection-chokepoints",
            source_ref="main",
            source_sha="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status=ChokepointSnapshot.Status.ACTIVE,
            entry_count=10,
        )
        staged = ChokepointSnapshot.objects.create(
            source_repo="https://github.com/iimp0ster/detection-chokepoints",
            source_ref="main",
            source_sha="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            status=ChokepointSnapshot.Status.STAGED,
            entry_count=15,
        )

        _activate_chokepoint_snapshot(staged)

        old_active.refresh_from_db()
        staged.refresh_from_db()
        self.assertEqual(old_active.status, ChokepointSnapshot.Status.ARCHIVED)
        self.assertEqual(staged.status, ChokepointSnapshot.Status.ACTIVE)
        self.assertIsNotNone(staged.activated_at)

        version_row = PlatformDataVersion.objects.get(framework="detection-chokepoints")
        self.assertEqual(version_row.version, "bbbbbbbbbbbb")
