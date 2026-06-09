# AI Model Configuration Updates

## Summary
This document reflects the canonical AI model catalog currently implemented in `backend/ai_assistant/engine.py`.

## Current Canonical Models

### OpenAI GPT (`_GPT_MODEL_MAP`)
| Canonical Name | API ID |
|---|---|
| `GPT-5.5` | `gpt-5.5` |
| `GPT-5.4` | `gpt-5.4` |
| `GPT-5.4-MINI` | `gpt-5.4-mini` |

### Google Gemini (`_GEMINI_MODEL_MAP`)
| Canonical Name | API ID |
|---|---|
| `GEMINI-3.1-PRO-PREVIEW` | `gemini-3.1-pro-preview` |
| `GEMINI-3.5-FLASH` | `gemini-3.5-flash` |
| `GEMINI-3-FLASH-PREVIEW` | `gemini-3-flash-preview` |
| `GEMINI-3.1-FLASH-LITE` | `gemini-3.1-flash-lite` |
| `GEMINI-3.1-FLASH-LITE-PREVIEW` | `gemini-3.1-flash-lite-preview` |

### Anthropic Claude (`_CLAUDE_MODEL_MAP`)
| Canonical Name | API ID |
|---|---|
| `CLAUDE-OPUS-4.7` | `claude-opus-4-7` |
| `CLAUDE-SONNET-4.6` | `claude-sonnet-4-6` |
| `CLAUDE-HAIKU-4.5-20251001` | `claude-haiku-4-5-20251001` |

## Fallback Priority

`FALLBACK_PRIORITY` in `engine.py` is:

1. `GPT-5.5`
2. `GPT-5.4`
3. `GPT-5.4-MINI`
4. `GEMINI-3.1-PRO-PREVIEW`
5. `GEMINI-3.5-FLASH`
6. `GEMINI-3-FLASH-PREVIEW`
7. `GEMINI-3.1-FLASH-LITE`
8. `GEMINI-3.1-FLASH-LITE-PREVIEW`
9. `CLAUDE-OPUS-4.7`
10. `CLAUDE-SONNET-4.6`
11. `CLAUDE-HAIKU-4.5-20251001`
12. `AZURE-OPENAI`
13. `OLLAMA`

## Engine Architecture Update

Model mapping is centralized at module scope in `backend/ai_assistant/engine.py` using:
- `_GPT_MODEL_MAP`
- `_GEMINI_MODEL_MAP`
- `_CLAUDE_MODEL_MAP`

This replaces the older per-function inline map closures and provides a single source of truth reused by all AI generation paths.

## Migration Reference

Supported model choices for `UserAISettings.preferred_model` are aligned through:

`backend/ai_assistant/migrations/0012_alter_useraisettings_preferred_model_supported_models.py`
