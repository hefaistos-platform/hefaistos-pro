from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import TestCase

from ai_assistant.engine import run_custom_prompt, suggest_rule_improvements, generate_similar_rules


class RunCustomPromptFallbackTests(TestCase):
    def _settings(self):
        return SimpleNamespace(
            preferred_model='GPT-5.5',
            get_openai_key=lambda: 'sk-test',
            get_gemini_key=lambda: '',
            get_claude_key=lambda: '',
            get_ollama_url=lambda: '',
            get_ollama_model=lambda: '',
            get_azure_openai_key=lambda: '',
            get_azure_openai_endpoint=lambda: '',
            get_azure_openai_deployment=lambda: '',
        )

    @patch('ai_assistant.engine.openai')
    def test_falls_back_to_responses_api_when_chat_operation_is_unsupported(self, mock_openai):
        client = MagicMock()
        mock_openai.OpenAI.return_value = client
        client.chat.completions.create.side_effect = Exception(
            "Error code: 400 - {'error': {'message': 'The requested operation is unsupported.'}}"
        )
        client.responses.create.return_value = SimpleNamespace(output_text='Generated summary from responses API.')

        text, provider = run_custom_prompt(
            self._settings(),
            user_prompt='Summarize current gaps.',
            system_prompt='Return concise markdown.',
        )

        self.assertEqual(provider, 'GPT-5.5')
        self.assertEqual(text, 'Generated summary from responses API.')
        self.assertTrue(client.responses.create.called)


class RulePromptReferenceContextTests(TestCase):
    def _settings(self):
        return SimpleNamespace(
            preferred_model='GPT-5.5',
            get_openai_key=lambda: 'sk-test',
            get_gemini_key=lambda: '',
            get_claude_key=lambda: '',
            get_ollama_url=lambda: '',
            get_ollama_model=lambda: '',
            get_azure_openai_key=lambda: '',
            get_azure_openai_endpoint=lambda: '',
            get_azure_openai_deployment=lambda: '',
        )

    @patch('ai_assistant.engine._resolve_provider', return_value='GPT-5.5')
    @patch('ai_assistant.engine.build_available', return_value=['GPT-5.5'])
    @patch('ai_assistant.engine.openai')
    def test_suggest_rule_improvements_injects_reference_examples(self, mock_openai, _mock_available, _mock_provider):
        mock_client = MagicMock()
        mock_openai.OpenAI.return_value = mock_client
        mock_response = MagicMock()
        mock_response.choices[0].message.content = 'ok'
        mock_client.chat.completions.create.return_value = mock_response

        suggest_rule_improvements(
            self._settings(),
            rule_content='SecurityEvent | where EventID == 4688',
            rule_format='KQL',
            reference_context=[{
                'title': 'Suspicious Process Spawn',
                'query': 'SecurityEvent | where ProcessCommandLine has "-enc"',
                'repo_name': 'battle-tested-rules',
                'repo_path': 'kql/process/suspicious_process.jsonl',
                'tags': ['process', 'powershell'],
            }],
        )

        call_args = mock_client.chat.completions.create.call_args
        messages = call_args[1]['messages']
        user_msg = next(m for m in messages if m['role'] == 'user')
        self.assertIn('REFERENCE EXAMPLES', user_msg['content'])
        self.assertIn('source: battle-tested-rules', user_msg['content'])
        self.assertIn('kql/process/suspicious_process.jsonl', user_msg['content'])

    @patch('ai_assistant.engine._resolve_provider', return_value='GPT-5.5')
    @patch('ai_assistant.engine.build_available', return_value=['GPT-5.5'])
    @patch('ai_assistant.engine.openai')
    def test_generate_similar_rules_injects_reference_examples(self, mock_openai, _mock_available, _mock_provider):
        mock_client = MagicMock()
        mock_openai.OpenAI.return_value = mock_client
        mock_response = MagicMock()
        mock_response.choices[0].message.content = 'rule 1\n---RULE---\nrule 2'
        mock_client.chat.completions.create.return_value = mock_response

        generate_similar_rules(
            self._settings(),
            rule_content='index=windows EventCode=4688',
            rule_format='SPL',
            variation_type='technique',
            num_variations=2,
            target_format='SPL',
            reference_context=[{
                'title': 'SPL Process Spawn Baseline',
                'query': 'index=windows EventCode=4688 | stats count by process_name',
                'repo_name': 'battle-tested-rules',
            }],
        )

        call_args = mock_client.chat.completions.create.call_args
        messages = call_args[1]['messages']
        user_msg = next(m for m in messages if m['role'] == 'user')
        self.assertIn('REFERENCE EXAMPLES', user_msg['content'])
        self.assertIn('SPL Process Spawn Baseline', user_msg['content'])
