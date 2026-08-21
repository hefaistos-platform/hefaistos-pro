"""
Test-specific settings that override INSTALLED_APPS to exclude daphne
(which has a Python 3.12 compatibility issue in CI environments).
"""
from core.settings import *  # noqa: F401, F403

INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'daphne']  # noqa: F405

# Use in-memory channel layer for tests
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}
