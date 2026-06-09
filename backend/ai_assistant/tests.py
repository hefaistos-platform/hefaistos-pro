from django.contrib.auth import get_user_model
from django.test import TestCase

from organizations.models import Organization
from platform_data.models import MitreAttackTechnique
from playbooks.models import PlaybookGraph, CapabilityAbstraction

from .schema import (
    _build_playbook_generation_context,
    _extract_threat_report_parts,
    _map_layer_name,
    _parse_capability_entries,
)


class PlaybookGenerationContextTests(TestCase):
    def test_build_generation_context_includes_selected_capability_abstractions(self):
        org = Organization.objects.create(name="AI Org")
        User = get_user_model()
        user = User.objects.create_user(username="aiuser", password="password", organization=org)
        technique = MitreAttackTechnique.objects.create(
            technique_id="T1218.005",
            stix_id="attack-pattern--ai-test",
            name="Mshta",
            description="Signed binary proxy execution via Mshta",
            url="https://example.com/t1218.005",
        )
        graph = PlaybookGraph.objects.create(
            title="AI Workbench",
            organization=org,
            author=user,
            mitre_technique=technique,
            goal="Detect malicious mshta execution",
            detection_focus_layer="PROCESS_BEHAVIOR",
        )
        capability = CapabilityAbstraction.objects.create(
            technique=technique,
            organization=org,
            created_by=user,
            updated_by=user,
            abstraction_layer=CapabilityAbstraction.AbstractionLayer.PROCESS_BEHAVIOR,
            component_artifact="mshta child process chain",
            detection_value="Better behavior anchor",
            source_kind=CapabilityAbstraction.SourceKind.CUSTOM,
        )
        graph.selected_capability_abstractions.add(capability)

        context = _build_playbook_generation_context(graph)

        self.assertEqual(context["detection_focus_layer"], "PROCESS_BEHAVIOR")
        self.assertEqual(len(context["capability_abstractions"]), 1)
        self.assertEqual(
            context["capability_abstractions"][0]["component_artifact"],
            "mshta child process chain",
        )


class ThreatReportMappingHelperTests(TestCase):
    def test_extract_threat_report_parts_accepts_heading_style_keys(self):
        payload = {
            "PART 1: DETECTION STRATEGY": {"a": 1},
            "Part 2 - Deep Dive": {"b": 2},
            "Part 4 / SOAR Configuration": {"c": 3},
            "Part 5 Testing & Validation": {"d": 4},
        }

        part1, part2, part4, part5 = _extract_threat_report_parts(payload)

        self.assertEqual(part1, {"a": 1})
        self.assertEqual(part2, {"b": 2})
        self.assertEqual(part4, {"c": 3})
        self.assertEqual(part5, {"d": 4})

    def test_parse_capability_entries_maps_abstraction_layer_names(self):
        part1 = {
            "Capability Abstraction Library": [
                {
                    "ATT&CK Technique Code": "T1059.001",
                    "Abstraction Layer": "Tool/Binary",
                    "Component / Artifact": "powershell.exe",
                    "Adversary Purpose": "Execute encoded command payload",
                },
                {
                    "ATT&CK Technique Code": "T1053.005",
                    "Abstraction Layer": "Process behavior",
                    "Component / Artifact": "schtasks.exe parent-child chain",
                },
            ]
        }

        parsed = _parse_capability_entries(part1, fallback_technique_codes=[])

        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["abstraction_layer"], CapabilityAbstraction.AbstractionLayer.TOOL)
        self.assertEqual(parsed[1]["abstraction_layer"], CapabilityAbstraction.AbstractionLayer.PROCESS_BEHAVIOR)
        self.assertEqual(_map_layer_name("Network behavior"), CapabilityAbstraction.AbstractionLayer.NETWORK_BEHAVIOR)
