from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import TestCase

from ai_assistant.engine import run_custom_prompt


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
