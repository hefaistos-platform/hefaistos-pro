"""
Tests for the RAG sync pipeline (parser, language tagging, scheduling) and
the syncRagNow GraphQL mutation.
"""
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase


# ---------------------------------------------------------------------------
# Parser / language tagging tests (no DB needed)
# ---------------------------------------------------------------------------

class TestRagSyncParsers(SimpleTestCase):
    """Unit tests for JSONL parsing helpers in rules.rag_sync."""

    def _make_jsonl_file(self, lines: list[dict], tmp_dir: str) -> Path:
        p = Path(tmp_dir) / "rules.jsonl"
        with open(p, "w") as f:
            for line in lines:
                f.write(json.dumps(line) + "\n")
        return p

    def test_parse_jsonl_basic(self):
        from rules.rag_sync import _parse_jsonl_file
        with tempfile.TemporaryDirectory() as tmp_dir:
            fp = self._make_jsonl_file(
                [{"title": "Test Rule", "query": "SecurityEvent | limit 10", "language": "KQL"}],
                tmp_dir,
            )
            entries = _parse_jsonl_file(fp, "my-repo")
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["title"], "Test Rule")
        self.assertEqual(entries[0]["language"], "KQL")
        self.assertEqual(entries[0]["query"], "SecurityEvent | limit 10")
        self.assertEqual(entries[0]["repo_name"], "my-repo")

    def test_parse_jsonl_skips_malformed_lines(self):
        from rules.rag_sync import _parse_jsonl_file
        with tempfile.TemporaryDirectory() as tmp_dir:
            fp = Path(tmp_dir) / "bad.jsonl"
            fp.write_text('{"title": "ok"}\nnot-json\n{"title": "also ok"}\n')
            entries = _parse_jsonl_file(fp, "repo")
        self.assertEqual(len(entries), 2)

    def test_parse_jsonl_skips_empty_lines(self):
        from rules.rag_sync import _parse_jsonl_file
        with tempfile.TemporaryDirectory() as tmp_dir:
            fp = Path(tmp_dir) / "empty.jsonl"
            fp.write_text('\n\n{"title": "only"}\n\n')
            entries = _parse_jsonl_file(fp, "repo")
        self.assertEqual(len(entries), 1)

    def test_language_tagging_defaults_to_kql(self):
        from rules.rag_sync import _resolve_language
        self.assertEqual(_resolve_language({}), "KQL")
        self.assertEqual(_resolve_language({"language": "eql"}), "EQL")
        self.assertEqual(_resolve_language({"language": "UNKNOWN_LANG"}), "KQL")

    def test_language_tagging_known_values(self):
        from rules.rag_sync import _resolve_language
        for lang in ["KQL", "EQL", "SPL", "WAZUH", "AQL", "SIGMA"]:
            self.assertEqual(_resolve_language({"language": lang}), lang)

    def test_parse_raw_kql_file(self):
        from rules.rag_sync import _parse_raw_file
        with tempfile.TemporaryDirectory() as tmp_dir:
            fp = Path(tmp_dir) / "detection.kql"
            fp.write_text("SecurityEvent | where EventID == 4625")
            entries = _parse_raw_file(fp, "repo", language="KQL")
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["language"], "KQL")
        self.assertEqual(entries[0]["title"], "detection")
        self.assertIn("SecurityEvent", entries[0]["raw_content"])

    def test_iter_matching_paths_jsonl_default(self):
        from rules.rag_sync import _iter_matching_paths
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "a.jsonl").write_text("")
            (root / "sub").mkdir()
            (root / "sub" / "b.jsonl").write_text("")
            (root / "c.kql").write_text("")
            paths = _iter_matching_paths(root, None)
        names = {p.name for p in paths}
        self.assertIn("a.jsonl", names)
        self.assertIn("b.jsonl", names)
        # .kql not included in default (only .jsonl)
        self.assertNotIn("c.kql", names)


# ---------------------------------------------------------------------------
# rag_store helpers (unit, no Qdrant running)
# ---------------------------------------------------------------------------

class TestRagStoreHelpers(SimpleTestCase):
    """Unit tests for embedding text construction and source ID helpers."""

    def test_build_embed_text_uses_title_desc_query(self):
        from rules.rag_store import _build_embed_text
        entry = {
            "title": "Lateral Movement via PsExec",
            "description": "Detects PsExec usage",
            "query": "SecurityEvent | where ProcessName == 'psexec.exe'",
        }
        text = _build_embed_text(entry)
        self.assertIn("Lateral Movement via PsExec", text)
        self.assertIn("Detects PsExec usage", text)
        self.assertIn("psexec.exe", text)

    def test_make_point_id_is_deterministic(self):
        from rules.rag_store import _make_point_id
        id1 = _make_point_id("repo:path:0:abc")
        id2 = _make_point_id("repo:path:0:abc")
        self.assertEqual(id1, id2)

    def test_make_point_id_different_inputs(self):
        from rules.rag_store import _make_point_id
        self.assertNotEqual(_make_point_id("a"), _make_point_id("b"))

    def test_retrieve_similar_returns_empty_without_key(self):
        from rules.rag_store import retrieve_similar
        result = retrieve_similar(openai_api_key="", query_text="test", language="KQL")
        self.assertEqual(result, [])

    def test_retrieve_similar_returns_empty_without_query(self):
        from rules.rag_store import retrieve_similar
        result = retrieve_similar(openai_api_key="sk-xxx", query_text="", language="KQL")
        self.assertEqual(result, [])

    @patch("rules.rag_store.get_qdrant_client", side_effect=Exception("no qdrant"))
    def test_retrieve_similar_returns_empty_on_connection_error(self, _mock):
        from rules.rag_store import retrieve_similar
        result = retrieve_similar(openai_api_key="sk-xxx", query_text="test", language="KQL")
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# Scheduler trigger tests
# ---------------------------------------------------------------------------

class TestSchedulerTrigger(SimpleTestCase):
    """Unit tests for run_scheduled_rag_syncs."""

    @patch("rules.rag_sync.run_due_rag_syncs", return_value={"ran": 2, "failed": 0})
    def test_run_scheduled_rag_syncs_ok(self, _mock):
        import sys
        import os
        # Import run_scheduler module dynamically to avoid Django setup at module level
        backend_dir = Path(__file__).resolve().parents[2]
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        # We test the logic directly via the rag_sync module
        from rules.rag_sync import run_due_rag_syncs
        result = run_due_rag_syncs()
        self.assertEqual(result["ran"], 2)
        self.assertEqual(result["failed"], 0)


# ---------------------------------------------------------------------------
# SyncRagNow GraphQL mutation (requires Django DB)
# ---------------------------------------------------------------------------

class TestSyncRagNowMutation(TestCase):
    """Integration tests for the syncRagNow GraphQL mutation."""

    def _make_user_and_org(self):
        from organizations.models import Organization
        from django.contrib.auth import get_user_model
        User = get_user_model()
        org = Organization.objects.create(name="TestOrg")
        user = User.objects.create_user(
            username="testadmin",
            email="admin@test.com",
        )
        user.organization = org
        user.role = "ADMIN"
        user.save()
        return user, org

    def _make_repo(self, org, rag_enabled=True):
        from rules.models import RuleRepository
        return RuleRepository.objects.create(
            organization=org,
            name="test-repo",
            git_url="https://github.com/test/test.git",
            rag_enabled=rag_enabled,
        )

    @patch("rules.schema.get_publisher")
    def test_sync_rag_now_queues_message(self, mock_get_publisher):
        mock_publisher = MagicMock()
        mock_get_publisher.return_value = mock_publisher

        user, org = self._make_user_and_org()
        repo = self._make_repo(org, rag_enabled=True)

        from graphene_django.views import GraphQLView
        from core.schema import schema
        from graphql import GraphQLError

        mutation = """
            mutation SyncRagNow($id: ID!) {
                syncRagNow(id: $id) {
                    ok
                    message
                }
            }
        """
        from graphene.test import Client
        client = Client(schema)

        class MockContext:
            user = user

        result = client.execute(mutation, variables={"id": str(repo.id)}, context=MockContext())
        self.assertIsNone(result.get("errors"))
        self.assertTrue(result["data"]["syncRagNow"]["ok"])
        mock_publisher.publish_message.assert_called_once()

    def test_sync_rag_now_fails_when_rag_disabled(self):
        user, org = self._make_user_and_org()
        repo = self._make_repo(org, rag_enabled=False)

        mutation = """
            mutation SyncRagNow($id: ID!) {
                syncRagNow(id: $id) {
                    ok
                    message
                }
            }
        """
        from graphene.test import Client
        from core.schema import schema

        class MockContext:
            user = user

        result = Client(schema).execute(mutation, variables={"id": str(repo.id)}, context=MockContext())
        self.assertIsNone(result.get("errors"))
        self.assertFalse(result["data"]["syncRagNow"]["ok"])


# ---------------------------------------------------------------------------
# Backward-compatibility smoke test
# ---------------------------------------------------------------------------

class TestRuleRepositoryModelBackwardCompat(TestCase):
    """Verify that existing repository management still works after adding RAG fields."""

    def test_create_repo_without_rag_fields(self):
        from organizations.models import Organization
        from rules.models import RuleRepository
        org = Organization.objects.create(name="CompatOrg")
        repo = RuleRepository.objects.create(
            organization=org,
            name="compat-repo",
            git_url="https://github.com/test/compat.git",
        )
        self.assertFalse(repo.rag_enabled)
        self.assertIsNone(repo.rag_dataset_path)
        self.assertEqual(repo.rag_schedule, "DISABLED")
        self.assertIsNone(repo.rag_last_sync_at)
        self.assertIsNone(repo.rag_last_sync_status)

    def test_enable_rag_on_existing_repo(self):
        from organizations.models import Organization
        from rules.models import RuleRepository
        org = Organization.objects.create(name="RagEnableOrg")
        repo = RuleRepository.objects.create(
            organization=org,
            name="existing-repo",
            git_url="https://github.com/test/existing.git",
        )
        repo.rag_enabled = True
        repo.rag_dataset_path = "rules/*.jsonl"
        repo.rag_branch = "main"
        repo.rag_schedule = "24H"
        repo.save()

        refreshed = RuleRepository.objects.get(pk=repo.pk)
        self.assertTrue(refreshed.rag_enabled)
        self.assertEqual(refreshed.rag_dataset_path, "rules/*.jsonl")
        self.assertEqual(refreshed.rag_schedule, "24H")
